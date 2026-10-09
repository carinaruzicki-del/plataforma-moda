import {
  canRequestWithdrawal,
  isCancellableByCustomer,
  ORDER_STATUSES,
  readableCode,
  type Order,
  type ReturnRequest,
} from '@plataforma/core';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { parse, requireMember, wrap } from './callable';
import { secureRandom } from './crypto';
import { EMAIL_SECRETS, notifyWithdrawal, sendOrderLinkEmail } from './emails';
import { getPayment, refundPayment } from './mp/api';
import { syncPayment } from './payments';
import { getSellerToken, MP_SECRETS } from './mp/credentials';
import { UserError } from './orders/plan';
import { runTransition } from './orders/transition';
import { getOrder, getStore, paths } from './repo';

const SECRETS = [...MP_SECRETS, ...EMAIL_SECRETS];

const orderRefSchema = z.object({
  storeId: z.string().min(1),
  orderId: z.string().min(1),
  /** Clave del link del email, para clientas que compraron sin cuenta. */
  token: z.string().optional(),
});

function sameToken(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** La clienta puede actuar sobre su pedido si inició sesión con la misma cuenta o tiene el link del email. */
function assertCustomer(req: CallableRequest<unknown>, order: Order, token?: string) {
  const uid = req.auth?.uid;
  if (uid && order.customer.uid === uid) return;
  if (token && sameToken(token, order.accessToken)) return;
  throw new UserError('No encontramos ese pedido.', 'not-found');
}

/** Datos públicos del pedido para la clienta (sin la clave ni el historial interno). */
function publicOrder(o: Order) {
  const { accessToken: _t, history, ...rest } = o;
  return { ...rest, history: history.map(({ at, to }) => ({ at, to })) };
}

/**
 * Ver un pedido desde el link del email, sin cuenta. Cuando la clienta vuelve de Mercado Pago,
 * la URL trae `payment_id`: si el pedido sigue pendiente, se consulta ese pago en el momento
 * (no hace falta esperar el aviso de Mercado Pago, que en desarrollo local no llega).
 */
export const getMyOrder = onCall(
  { secrets: SECRETS },
  wrap(async (req) => {
    const { storeId, orderId, token, paymentId } = parse(orderRefSchema.extend({ paymentId: z.string().regex(/^\d{1,20}$/).optional() }), req.data);
    let order = await getOrder(storeId, orderId);
    if (!order) throw new UserError('No encontramos ese pedido.', 'not-found');
    assertCustomer(req, order, token);
    if (paymentId && order.status === 'pago_pendiente') {
      try {
        const mpToken = await getSellerToken(storeId);
        await syncPayment(storeId, await getPayment(mpToken, paymentId));
        order = (await getOrder(storeId, orderId)) ?? order;
      } catch {
        // Si Mercado Pago no responde, se confirma igual con el aviso o la consulta periódica.
      }
    }
    return { order: publicOrder(order) };
  }),
);

/** La clienta cancela antes del envío. Si estaba pagado, se reembolsa solo. */
export const cancelMyOrder = onCall(
  { secrets: SECRETS },
  wrap(async (req) => {
    const { storeId, orderId, token } = parse(orderRefSchema, req.data);
    const order = await runTransition({
      storeId,
      orderId,
      to: 'cancelado',
      by: 'clienta',
      note: 'Cancelado por la clienta',
      guard: (o) => {
        assertCustomer(req, o, token);
        if (!isCancellableByCustomer(o.status)) {
          throw new UserError('Este pedido ya salió y no se puede cancelar. Podés pedir el arrepentimiento cuando lo recibas.');
        }
      },
    });
    return { order: order ? publicOrder(order) : null };
  }),
);

/**
 * Botón de arrepentimiento (Resolución 424/2020): dentro de los 10 días corridos desde la
 * entrega. Genera el código de trámite y se lo envía a la clienta en el momento.
 */
export const requestWithdrawal = onCall(
  { secrets: SECRETS },
  wrap(async (req) => {
    const { storeId, orderId, token, reason } = parse(orderRefSchema.extend({ reason: z.string().trim().max(500).optional() }), req.data);
    const now = Date.now();
    const retRef = paths.returns(storeId).doc();
    let ret: ReturnRequest | null = null;

    const order = await runTransition({
      storeId,
      orderId,
      to: 'devolucion',
      by: 'clienta',
      note: 'Arrepentimiento de compra',
      guard: (o) => {
        assertCustomer(req, o, token);
        if (!canRequestWithdrawal(o, now)) {
          throw new UserError('El plazo para arrepentirse de esta compra ya venció o el pedido todavía no fue entregado.');
        }
      },
      notify: false,
    });
    if (!order) throw new UserError('No encontramos ese pedido.', 'not-found');

    ret = {
      id: retRef.id,
      storeId,
      orderId,
      kind: 'arrepentimiento',
      code: `ARR-${readableCode(8, secureRandom)}`,
      status: 'solicitada',
      items: order.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      ...(reason ? { reason } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await retRef.set(ret);
    const store = await getStore(storeId);
    if (store) await notifyWithdrawal(store, order, ret);
    return { code: ret.code, order: publicOrder(order) };
  }),
);

const merchantUpdateSchema = z.object({
  storeId: z.string().min(1),
  orderId: z.string().min(1),
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional(),
  tracking: z
    .object({
      carrier: z.string().trim().max(40).optional(),
      trackingNumber: z.string().trim().max(60).optional(),
      trackingUrl: z.string().trim().url().max(300).optional(),
    })
    .optional(),
});

/** El comercio avanza el pedido: en preparación, listo para retirar, despachado, entregado, cancelado. */
export const updateOrderStatus = onCall(
  { secrets: SECRETS },
  wrap(async (req) => {
    const input = parse(merchantUpdateSchema, req.data);
    await requireMember(req, input.storeId);

    // Devolución recibida: primero se reembolsa en Mercado Pago, después se cierra el pedido.
    if (input.to === 'reembolsado') {
      const current = await getOrder(input.storeId, input.orderId);
      if (!current) throw new UserError('No encontramos ese pedido.', 'not-found');
      if (current.status === 'devolucion' && current.payment.paymentId) {
        const tokenMp = await getSellerToken(input.storeId);
        await refundPayment(tokenMp, current.payment.paymentId, `return-${current.id}`);
        const order = await runTransition({
          storeId: input.storeId,
          orderId: input.orderId,
          to: 'reembolsado',
          by: 'comercio',
          note: input.note ?? 'Devolución recibida y reembolsada',
          payment: { refundedAmount: current.totals.total, status: 'refunded' },
          onlyFrom: ['devolucion'],
        });
        const rets = await paths.returns(input.storeId).where('orderId', '==', input.orderId).get();
        await Promise.all(rets.docs.map((d) => d.ref.update({ status: 'reembolsada', updatedAt: Date.now() })));
        return { order };
      }
    }

    const order = await runTransition({
      storeId: input.storeId,
      orderId: input.orderId,
      to: input.to,
      by: 'comercio',
      ...(input.note ? { note: input.note } : {}),
      ...(input.tracking ? { tracking: input.tracking } : {}),
    });
    return { order };
  }),
);


/**
 * Botón de arrepentimiento sin cuenta: la clienta escribe su número de pedido y su email, y le
 * mandamos el link a ese email. Así nadie puede ver ni arrepentirse de un pedido ajeno.
 * La respuesta es siempre la misma, exista o no el pedido.
 */
export const sendOrderLink = onCall(
  { secrets: EMAIL_SECRETS },
  wrap(async (req) => {
    const { storeId, number, email } = parse(
      z.object({ storeId: z.string().min(1), number: z.string().trim().toUpperCase().min(4).max(12), email: z.string().trim().toLowerCase().email() }),
      req.data,
    );
    const snap = await paths.orders(storeId).where('number', '==', number).limit(1).get();
    const doc = snap.docs[0];
    if (doc) {
      const order = { ...(doc.data() as Order), id: doc.id };
      const store = await getStore(storeId);
      if (store && order.customer.email === email) await sendOrderLinkEmail(store, order);
    }
    return { ok: true };
  }),
);
