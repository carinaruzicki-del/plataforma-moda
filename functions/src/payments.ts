import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { MP_WEBHOOK_SECRET } from './config';
import { EMAIL_SECRETS } from './emails';
import { db } from './firebase';
import { findPaymentsByReference, getPayment, refundPayment, type Payment } from './mp/api';
import { getSellerToken, MP_SECRETS } from './mp/credentials';
import { verifyWebhookSignature } from './mp/signature';
import { runTransition } from './orders/transition';
import { getOrder, paths } from './repo';

/** Margen máximo para esperar un pago en efectivo (cupón de Rapipago o Pago Fácil). */
const MAX_CASH_WAIT_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Aplica a un pedido lo que dice Mercado Pago sobre un pago. Es idempotente: el mismo aviso
 * repetido no descuenta stock dos veces, porque la transición solo corre desde "pago pendiente".
 */
export async function syncPayment(storeId: string, payment: Payment): Promise<void> {
  const [refStore, orderId] = (payment.external_reference ?? '').split('/');
  if (refStore !== storeId || !orderId) {
    logger.warn('Pago con referencia ajena a la tienda', { storeId, paymentId: payment.id, ref: payment.external_reference });
    return;
  }
  const order = await getOrder(storeId, orderId);
  if (!order) return;
  const paymentId = String(payment.id);

  if (payment.status === 'approved') {
    if (Math.abs(payment.transaction_amount - order.totals.total) > 0.01) {
      logger.error('El monto pagado no coincide con el pedido', { storeId, orderId, paid: payment.transaction_amount, total: order.totals.total });
      return;
    }
    if (order.status === 'pago_pendiente') {
      await runTransition({
        storeId,
        orderId,
        to: 'pagado',
        by: 'sistema',
        payment: { paymentId, status: payment.status, paidAt: Date.parse(payment.date_approved ?? '') || Date.now() },
        onlyFrom: ['pago_pendiente'],
      });
      return;
    }
    if (order.status === 'cancelado' && !order.payment.paymentId) {
      // El pago llegó después de que venciera la reserva y se liberara el stock: se devuelve.
      const token = await getSellerToken(storeId);
      await refundPayment(token, paymentId, `late-${orderId}-${paymentId}`);
      await paths.order(storeId, orderId).update({
        'payment.paymentId': paymentId,
        'payment.status': 'refunded',
        'payment.refundedAmount': payment.transaction_amount,
        updatedAt: Date.now(),
      });
      logger.warn('Pago tardío reembolsado', { storeId, orderId, paymentId });
    }
    return;
  }

  if (payment.status === 'pending' || payment.status === 'in_process' || payment.status === 'authorized') {
    // Cupón de efectivo generado: se extiende la reserva hasta su vencimiento (con tope).
    if (order.status !== 'pago_pendiente') return;
    const until = Math.min(
      Date.parse(payment.date_of_expiration ?? '') || order.reservationExpiresAt || Date.now(),
      order.createdAt + MAX_CASH_WAIT_MS,
    );
    if (until > (order.reservationExpiresAt ?? 0)) {
      await paths.order(storeId, orderId).update({
        reservationExpiresAt: until,
        'payment.paymentId': paymentId,
        'payment.status': payment.status,
        updatedAt: Date.now(),
      });
    }
    return;
  }

  if (payment.status === 'refunded' || payment.status === 'charged_back') {
    await paths.order(storeId, orderId).update({ 'payment.status': payment.status, updatedAt: Date.now() });
    if (payment.status === 'charged_back') logger.warn('Contracargo en un pedido', { storeId, orderId, paymentId });
  }
  // rejected / cancelled: no se hace nada; la clienta puede reintentar y la reserva vence sola.
}

/**
 * Aviso de Mercado Pago. Se valida la firma y, además, se vuelve a consultar el pago con el
 * token del comercio: el contenido del aviso nunca se usa directamente.
 */
export const mpWebhook = onRequest({ secrets: [...MP_SECRETS, MP_WEBHOOK_SECRET, ...EMAIL_SECRETS] }, async (req, res) => {
  const storeId = String(req.query.store ?? '');
  const type = String(req.query.type ?? req.query.topic ?? req.body?.type ?? '');
  const dataId = String(req.query['data.id'] ?? req.query.id ?? req.body?.data?.id ?? '');

  if (!storeId || !dataId || (type && type !== 'payment')) {
    res.status(200).send('ignorado');
    return;
  }

  const ok = verifyWebhookSignature({
    secret: MP_WEBHOOK_SECRET.value(),
    signatureHeader: req.get('x-signature'),
    requestId: req.get('x-request-id'),
    dataId,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!ok) {
    logger.warn('Aviso de Mercado Pago con firma inválida', { storeId, dataId });
    res.status(401).send('firma inválida');
    return;
  }

  try {
    const token = await getSellerToken(storeId);
    const payment = await getPayment(token, dataId);
    await syncPayment(storeId, payment);
    res.status(200).send('ok');
  } catch (e) {
    logger.error('Error procesando aviso de Mercado Pago', { storeId, dataId, error: String(e) });
    // 500 hace que Mercado Pago reintente más tarde.
    res.status(500).send('error');
  }
});

/**
 * Cada 5 minutos: pedidos cuya reserva venció. Antes de cancelar se consulta a Mercado Pago
 * por si el pago entró y el aviso se perdió. Si no hay pago, se cancela y se libera el stock.
 */
export const expireReservations = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'America/Argentina/Buenos_Aires', secrets: [...MP_SECRETS, ...EMAIL_SECRETS] },
  async () => {
    const now = Date.now();
    const snap = await db
      .collectionGroup('orders')
      .where('status', '==', 'pago_pendiente')
      .where('reservationExpiresAt', '<', now)
      .limit(200)
      .get();

    for (const doc of snap.docs) {
      const storeId = doc.ref.parent.parent?.id;
      if (!storeId) continue;
      try {
        const token = await getSellerToken(storeId);
        const payments = await findPaymentsByReference(token, `${storeId}/${doc.id}`);
        for (const p of payments) await syncPayment(storeId, p);
      } catch (e) {
        logger.warn('No se pudo consultar Mercado Pago antes de vencer la reserva', { storeId, orderId: doc.id, error: String(e) });
      }
      const fresh = await getOrder(storeId, doc.id);
      if (fresh?.status === 'pago_pendiente' && (fresh.reservationExpiresAt ?? 0) < now) {
        await runTransition({
          storeId,
          orderId: doc.id,
          to: 'cancelado',
          by: 'sistema',
          note: 'Venció el plazo de pago',
          onlyFrom: ['pago_pendiente'],
        }).catch((e) => logger.error('No se pudo vencer la reserva', { storeId, orderId: doc.id, error: String(e) }));
      }
    }
  },
);
