import { checkoutInputSchema, type Order } from '@plataforma/core';
import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import { parse, wrap } from './callable';
import { FUNCTIONS_BASE_URL, MEDIA_BASE_URL, storeUrl } from './config';
import { randomToken, secureRandom } from './crypto';
import { db } from './firebase';
import { createPreference } from './mp/api';
import { getSellerToken, MP_SECRETS } from './mp/credentials';
import { buildPreference, planCheckout, UserError } from './orders/plan';
import { runTransition } from './orders/transition';
import { getPlan, getProducts, getStore, paths, writeVariants } from './repo';

/**
 * Checkout: el servidor recalcula precios y stock con lo que hay en la base (nunca con lo que
 * manda el navegador), aparta las unidades, crea el pedido en "pago pendiente" y genera el
 * cobro en Mercado Pago con la cuenta del comercio y la comisión de la plataforma.
 */
export const createCheckout = onCall(
  { secrets: MP_SECRETS },
  wrap(async (req) => {
    const input = parse(checkoutInputSchema, req.data);
    const store = await getStore(input.storeId);
    if (!store) throw new UserError('No encontramos la tienda.', 'not-found');
    const plan = await getPlan(store.plan);
    const orderRef = paths.orders(store.id).doc();
    const now = Date.now();
    const accessToken = randomToken();

    const order = await db.runTransaction(async (tx) => {
      const fresh = await getStore(store.id, tx);
      if (!fresh) throw new UserError('No encontramos la tienda.', 'not-found');
      const products = await getProducts(store.id, input.items.map((i) => i.productId), tx);
      const { order, variantsByProduct } = planCheckout({
        input,
        store: fresh,
        products,
        plan,
        customerUid: req.auth?.uid ?? null,
        now,
        random: secureRandom,
        accessToken,
      });
      writeVariants(tx, store.id, variantsByProduct, now);
      tx.create(orderRef, order);
      return { ...order, id: orderRef.id } as Order;
    });

    try {
      const token = await getSellerToken(store.id);
      const base = storeUrl(store.subdomain, store.customDomain?.verified ? store.customDomain.host : null);
      const pref = await createPreference(
        token,
        buildPreference({
          order,
          store,
          storeUrl: base,
          notificationUrl: `${FUNCTIONS_BASE_URL.value()}/mpWebhook?store=${encodeURIComponent(store.id)}`,
          publicMediaUrl: (p) => (MEDIA_BASE_URL.value() ? `${MEDIA_BASE_URL.value()}/${encodeURIComponent(p)}?alt=media` : ''),
        }),
        `pref-${order.id}`,
      );
      await orderRef.update({ 'payment.preferenceId': pref.id, updatedAt: Date.now() });
      return {
        orderId: order.id,
        number: order.number,
        accessToken,
        checkoutUrl: pref.init_point,
        sandboxCheckoutUrl: pref.sandbox_init_point,
      };
    } catch (e) {
      // Sin cobro no hay pedido: se libera el stock apartado.
      logger.error('No se pudo crear el cobro en Mercado Pago', { storeId: store.id, orderId: order.id, error: String(e) });
      await runTransition({
        storeId: store.id,
        orderId: order.id,
        to: 'cancelado',
        by: 'sistema',
        note: 'No se pudo generar el cobro',
        onlyFrom: ['pago_pendiente'],
        notify: false,
      }).catch(() => undefined);
      throw new UserError('No pudimos iniciar el pago. Probá de nuevo en unos minutos.');
    }
  }),
);
