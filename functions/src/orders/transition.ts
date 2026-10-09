import type { Actor, Order, OrderStatus } from '@plataforma/core';
import { logger } from 'firebase-functions';
import { notifyCustomer, notifyStoreNewOrder } from '../emails';
import { db } from '../firebase';
import { refundPayment } from '../mp/api';
import { getSellerToken } from '../mp/credentials';
import { getOrder, getProducts, getStore, paths, writeVariants } from '../repo';
import { planTransition, UserError } from './plan';

export interface TransitionRequest {
  storeId: string;
  orderId: string;
  to: OrderStatus;
  by: Actor;
  note?: string;
  tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string };
  payment?: Partial<Order['payment']>;
  /** Validación extra con el pedido leído dentro de la transacción (por ejemplo, que sea de la clienta). */
  guard?: (order: Order) => void;
  /** Si el pedido ya no está en este estado, no hace nada (para avisos repetidos o carreras). */
  onlyFrom?: OrderStatus[];
  /** false = no mandar emails (por ejemplo, si el pedido nunca llegó a mostrarse a la clienta). */
  notify?: boolean;
}

/**
 * Cambia el estado de un pedido de forma segura: lee pedido y prendas, valida con la tabla de
 * estados, mueve el stock y escribe todo en una sola transacción. Después reembolsa si hace
 * falta y manda los avisos. Devuelve el pedido actualizado, o null si `onlyFrom` no coincidió.
 */
export async function runTransition(req: TransitionRequest): Promise<Order | null> {
  const now = Date.now();
  const result = await db.runTransaction(async (tx) => {
    const order = await getOrder(req.storeId, req.orderId, tx);
    if (!order) throw new UserError('No encontramos ese pedido.', 'not-found');
    if (req.onlyFrom && !req.onlyFrom.includes(order.status)) return null;
    req.guard?.(order);
    const products = await getProducts(req.storeId, order.items.map((i) => i.productId), tx);
    const plan = planTransition({
      order,
      to: req.to,
      by: req.by,
      products,
      now,
      ...(req.note ? { note: req.note } : {}),
      ...(req.tracking ? { tracking: req.tracking } : {}),
      ...(req.payment ? { payment: req.payment } : {}),
    });
    writeVariants(tx, req.storeId, plan.variantsByProduct, now);
    tx.update(paths.order(req.storeId, req.orderId), plan.patch);
    return { after: { ...order, ...plan.patch } as Order, refund: plan.refund, from: order.status };
  });
  if (!result) return null;

  const store = await getStore(req.storeId);
  let order = result.after;

  if (result.refund && order.payment.paymentId) {
    try {
      const token = await getSellerToken(req.storeId);
      await refundPayment(token, order.payment.paymentId, `refund-${order.id}`);
      order =
        (await runTransition({
          storeId: req.storeId,
          orderId: req.orderId,
          to: 'reembolsado',
          by: 'sistema',
          note: 'Reembolso total en Mercado Pago',
          payment: { refundedAmount: order.totals.total },
          onlyFrom: ['cancelado'],
        })) ?? order;
    } catch (e) {
      // El pedido queda cancelado; el reembolso se reintenta desde el panel o la administración.
      logger.error('Falló el reembolso en Mercado Pago', { storeId: req.storeId, orderId: req.orderId, error: String(e) });
    }
  }

  if (store && req.notify !== false) {
    try {
      // Si hubo reembolso, la llamada recursiva ya avisó; acá solo avisamos el estado pedido.
      if (!(result.refund && order.status === 'reembolsado')) await notifyCustomer(store, order);
      if (req.to === 'pagado') await notifyStoreNewOrder(store, order);
    } catch (e) {
      logger.error('Falló un aviso por email', { orderId: req.orderId, error: String(e) });
    }
  }
  return order;
}
