/**
 * Lógica de pedidos sin Firebase: recibe los datos ya leídos y devuelve qué hay que escribir.
 * Así se puede testear entera, y las funciones del servidor solo leen, llaman acá y escriben
 * dentro de una transacción.
 */
import {
  applyStock,
  canTransition,
  computeTotals,
  groupByProduct,
  needsRefund,
  readableCode,
  stockEffect,
  StockError,
  type Actor,
  type CheckoutInput,
  type Order,
  type OrderItem,
  type OrderStatus,
  type Plan,
  type Product,
  type Store,
  type Variant,
} from '@plataforma/core';
import type { PreferenceBody } from '../mp/api';

/** Error con un mensaje que se le puede mostrar a la clienta o a la dueña tal cual. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-argument' | 'failed-precondition' | 'not-found' | 'permission-denied' = 'failed-precondition',
  ) {
    super(message);
    this.name = 'UserError';
  }
}

/** Minutos que se aparta el stock mientras la clienta paga. */
export const RESERVATION_MINUTES = 30;

export interface CheckoutPlan {
  order: Omit<Order, 'id'>;
  /** Variantes nuevas por prenda, con las unidades ya apartadas. */
  variantsByProduct: Map<string, Variant[]>;
}

export function planCheckout(opts: {
  input: CheckoutInput;
  store: Store;
  products: Map<string, Product>;
  plan: Plan;
  customerUid: string | null;
  now: number;
  random: () => number;
  accessToken: string;
}): CheckoutPlan {
  const { input, store, products, plan, now } = opts;

  if (store.status !== 'activa') throw new UserError('Esta tienda no está recibiendo pedidos en este momento.');
  if (!store.mpConnected) throw new UserError('Esta tienda todavía no configuró los pagos.');

  const items: OrderItem[] = [];
  for (const line of input.items) {
    const p = products.get(line.productId);
    if (!p || p.storeId !== store.id || !p.published) {
      throw new UserError('Una de las prendas del carrito ya no está disponible.', 'not-found');
    }
    const v = p.variants.find((x) => x.sku === line.sku);
    if (!v) throw new UserError(`El talle elegido de ${p.name} ya no existe.`, 'not-found');
    const same = items.find((i) => i.sku === v.sku && i.productId === p.id);
    if (same) {
      same.quantity += line.quantity;
      continue;
    }
    items.push({
      productId: p.id,
      sku: v.sku,
      name: p.name,
      size: v.size,
      ...(v.color ? { color: v.color } : {}),
      unitPrice: p.price,
      quantity: line.quantity,
      imagePath: p.media.find((m) => m.type === 'image')?.path ?? null,
    });
  }

  // Envío
  let shipping = 0;
  const delivery: Order['delivery'] = { method: input.delivery.method };
  if (input.delivery.method === 'retiro') {
    if (!store.pickup?.enabled) throw new UserError('Esta tienda no ofrece retiro en el local.');
  } else {
    const zoneId = input.delivery.zoneId;
    const zone = store.flatShipping?.enabled ? store.flatShipping.zones.find((z) => z.id === zoneId) : undefined;
    if (!zone) throw new UserError('Elegí una zona de envío válida.', 'invalid-argument');
    shipping = zone.price;
    delivery.zoneId = zone.id;
    delivery.address = input.delivery.address;
  }

  // Apartar stock (falla con un mensaje claro si no alcanza)
  const variantsByProduct = new Map<string, Variant[]>();
  for (const [productId, lines] of groupByProduct(items)) {
    const p = products.get(productId)!;
    try {
      variantsByProduct.set(productId, applyStock(p.variants, lines, 'reserve'));
    } catch (e) {
      if (e instanceof StockError) throw new UserError(`${p.name}: ${e.message}`);
      throw e;
    }
  }

  const totals = computeTotals(items, shipping, plan.commissionPct);

  const order: Omit<Order, 'id'> = {
    storeId: store.id,
    number: readableCode(6, opts.random),
    status: 'pago_pendiente',
    items,
    totals,
    customer: {
      uid: opts.customerUid,
      name: input.customer.name,
      email: input.customer.email.toLowerCase(),
      phone: input.customer.phone,
    },
    delivery,
    payment: { provider: 'mercadopago', preferenceId: null, paymentId: null, status: null, paidAt: null, refundedAmount: 0 },
    reservationExpiresAt: now + RESERVATION_MINUTES * 60_000,
    deliveredAt: null,
    accessToken: opts.accessToken,
    ...(input.note ? { note: input.note } : {}),
    history: [{ at: now, from: null, to: 'pago_pendiente', by: 'clienta' }],
    createdAt: now,
    updatedAt: now,
  };
  return { order, variantsByProduct };
}

export function buildPreference(opts: {
  order: Order;
  store: Store;
  storeUrl: string;
  notificationUrl: string;
  publicMediaUrl: (path: string) => string;
}): PreferenceBody {
  const { order, store, storeUrl } = opts;
  const orderUrl = `${storeUrl}/pedido/${order.id}?t=${encodeURIComponent(order.accessToken)}`;
  return {
    items: order.items.map((it) => {
      // Solo URLs públicas completas: Mercado Pago rechaza el cobro si la foto no es una URL válida.
      const picture = it.imagePath ? opts.publicMediaUrl(it.imagePath) : '';
      return {
        id: it.sku,
        title: `${it.name} · talle ${it.size}`.slice(0, 250),
        quantity: it.quantity,
        unit_price: it.unitPrice,
        currency_id: 'ARS' as const,
        category_id: 'fashion',
        ...(/^https?:\/\//.test(picture) ? { picture_url: picture } : {}),
      };
    }),
    payer: { name: order.customer.name, email: order.customer.email, phone: { number: order.customer.phone } },
    external_reference: `${store.id}/${order.id}`,
    ...(opts.notificationUrl.startsWith('https://') ? { notification_url: opts.notificationUrl } : {}),
    back_urls: { success: orderUrl, pending: orderUrl, failure: `${orderUrl}&pago=fallido` },
    auto_return: 'approved',
    marketplace_fee: order.totals.platformFee,
    statement_descriptor: store.name.slice(0, 22),
    // El cobro vence junto con la reserva de stock: después no se puede pagar un pedido sin stock apartado.
    expires: true,
    ...(order.reservationExpiresAt
      ? { expiration_date_to: new Date(order.reservationExpiresAt).toISOString() }
      : {}),
    ...(order.totals.shipping > 0 ? { shipments: { cost: order.totals.shipping, mode: 'not_specified' as const } } : {}),
    // Se permiten pagos pendientes (efectivo en Rapipago o Pago Fácil). Si no se acreditan
    // antes de que venza la reserva, el pedido se cancela solo y se libera el stock.
    binary_mode: false,
    metadata: { store_id: store.id, order_id: order.id },
  };
}

export interface TransitionPlan {
  patch: Partial<Order>;
  variantsByProduct: Map<string, Variant[]>;
  refund: boolean;
}

/**
 * Calcula un cambio de estado. Rechaza lo que no permite la tabla de estados del núcleo.
 * `products` tiene que traer las prendas del pedido leídas dentro de la misma transacción.
 */
export function planTransition(opts: {
  order: Order;
  to: OrderStatus;
  by: Actor;
  products: Map<string, Product>;
  now: number;
  note?: string;
  tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string };
  payment?: Partial<Order['payment']>;
}): TransitionPlan {
  const { order, to, by, now } = opts;
  const from = order.status;
  if (from === to) return { patch: {}, variantsByProduct: new Map(), refund: false };
  if (!canTransition(from, to, by)) {
    throw new UserError(`No se puede pasar el pedido de "${from}" a "${to}".`);
  }
  if (to === 'listo_para_retirar' && order.delivery.method !== 'retiro') {
    throw new UserError('Este pedido es con envío, no con retiro en el local.');
  }
  if (to === 'despachado' && order.delivery.method === 'retiro') {
    throw new UserError('Este pedido es para retirar en el local.');
  }

  const effect = stockEffect(from, to);
  const variantsByProduct = new Map<string, Variant[]>();
  if (effect) {
    for (const [productId, lines] of groupByProduct(order.items)) {
      const p = opts.products.get(productId);
      // Si la prenda se borró, no hay stock que mover.
      if (p) variantsByProduct.set(productId, applyStock(p.variants, lines, effect));
    }
  }

  const patch: Partial<Order> = {
    status: to,
    updatedAt: now,
    history: [...order.history, { at: now, from, to, by, ...(opts.note ? { note: opts.note } : {}) }],
  };
  if (to !== 'pago_pendiente') patch.reservationExpiresAt = null;
  if (to === 'entregado' && from !== 'devolucion') patch.deliveredAt = now;
  if (to === 'despachado' && opts.tracking) {
    patch.delivery = {
      ...order.delivery,
      carrier: opts.tracking.carrier ?? null,
      trackingNumber: opts.tracking.trackingNumber ?? null,
      trackingUrl: opts.tracking.trackingUrl ?? null,
    };
  }
  if (opts.payment) patch.payment = { ...order.payment, ...opts.payment };

  return { patch, variantsByProduct, refund: needsRefund(from, to) && !!order.payment.paymentId };
}
