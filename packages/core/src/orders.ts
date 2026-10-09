import type { Millis, OrderItem, OrderStatus, OrderTotals, Pesos } from './types';

/** Quién pide el cambio de estado. El servidor decide con esto si lo permite. */
export type Actor = 'clienta' | 'comercio' | 'sistema' | 'plataforma';

interface Transition {
  to: OrderStatus;
  by: readonly Actor[];
}

/**
 * Estados del pedido y quién puede moverlo a cada uno. Es la única fuente de verdad:
 * el servidor rechaza cualquier cambio que no esté en esta tabla.
 */
const TRANSITIONS: Record<OrderStatus, readonly Transition[]> = {
  pago_pendiente: [
    { to: 'pagado', by: ['sistema'] },
    { to: 'cancelado', by: ['sistema', 'clienta', 'comercio', 'plataforma'] },
  ],
  pagado: [
    { to: 'en_preparacion', by: ['comercio'] },
    { to: 'cancelado', by: ['clienta', 'comercio', 'plataforma'] },
  ],
  en_preparacion: [
    { to: 'listo_para_retirar', by: ['comercio'] },
    { to: 'despachado', by: ['comercio'] },
    { to: 'cancelado', by: ['clienta', 'comercio', 'plataforma'] },
  ],
  listo_para_retirar: [
    { to: 'entregado', by: ['comercio'] },
    { to: 'cancelado', by: ['comercio', 'plataforma'] },
  ],
  despachado: [{ to: 'entregado', by: ['comercio', 'sistema'] }],
  entregado: [{ to: 'devolucion', by: ['clienta', 'comercio', 'plataforma'] }],
  devolucion: [
    { to: 'reembolsado', by: ['comercio', 'sistema', 'plataforma'] },
    // Devolución rechazada (por ejemplo, la prenda llegó usada): vuelve a entregado.
    { to: 'entregado', by: ['comercio', 'plataforma'] },
  ],
  cancelado: [{ to: 'reembolsado', by: ['sistema', 'comercio', 'plataforma'] }],
  reembolsado: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pago_pendiente: 'Pago pendiente',
  pagado: 'Pagado',
  en_preparacion: 'En preparación',
  listo_para_retirar: 'Listo para retirar',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  devolucion: 'Devolución',
  reembolsado: 'Reembolsado',
};

export function canTransition(from: OrderStatus, to: OrderStatus, by: Actor): boolean {
  return TRANSITIONS[from].some((t) => t.to === to && t.by.includes(by));
}

export function nextStatuses(from: OrderStatus, by: Actor): OrderStatus[] {
  return TRANSITIONS[from].filter((t) => t.by.includes(by)).map((t) => t.to);
}

/** Estados en los que la plata ya entró y una cancelación implica reembolso. */
export const PAID_STATUSES: readonly OrderStatus[] = [
  'pagado',
  'en_preparacion',
  'listo_para_retirar',
  'despachado',
  'entregado',
  'devolucion',
];

/** Estados en los que el comercio todavía no despachó la mercadería. */
export function isCancellableByCustomer(status: OrderStatus): boolean {
  return canTransition(status, 'cancelado', 'clienta');
}

/**
 * Qué le pasa al stock con cada cambio de estado.
 * - `commit`: el pago se confirmó; las unidades apartadas salen del stock.
 * - `release`: el pedido se canceló sin pagar; se liberan las unidades apartadas.
 * - `restock`: el pedido estaba pagado y se canceló, o volvió la prenda; las unidades vuelven al stock.
 */
export type StockEffect = 'commit' | 'release' | 'restock' | null;

export function stockEffect(from: OrderStatus, to: OrderStatus): StockEffect {
  if (from === 'pago_pendiente' && to === 'pagado') return 'commit';
  if (from === 'pago_pendiente' && to === 'cancelado') return 'release';
  if (to === 'cancelado' && PAID_STATUSES.includes(from)) return 'restock';
  if (from === 'devolucion' && to === 'reembolsado') return 'restock';
  return null;
}

/** Si un pedido cancelado necesita reembolso en Mercado Pago. */
export function needsRefund(from: OrderStatus, to: OrderStatus): boolean {
  return to === 'cancelado' && PAID_STATUSES.includes(from);
}

// ---------------------------------------------------------------- dinero

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Totales del pedido. La comisión de la plataforma se calcula sobre los productos,
 * no sobre el envío, que el comercio solo traslada.
 */
export function computeTotals(
  items: Pick<OrderItem, 'unitPrice' | 'quantity'>[],
  shipping: Pesos,
  commissionPct: number,
): OrderTotals {
  if (items.length === 0) throw new Error('El pedido no tiene prendas.');
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity < 1) throw new Error('Cantidad inválida.');
    if (!(it.unitPrice >= 0)) throw new Error('Precio inválido.');
  }
  if (!(shipping >= 0)) throw new Error('Costo de envío inválido.');
  if (!(commissionPct >= 0 && commissionPct < 100)) throw new Error('Comisión inválida.');
  const subtotal = round2(items.reduce((s, it) => s + it.unitPrice * it.quantity, 0));
  const total = round2(subtotal + shipping);
  const platformFee = round2((subtotal * commissionPct) / 100);
  return { subtotal, shipping: round2(shipping), total, platformFee, commissionPct };
}

const MONEY = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatPesos(n: Pesos): string {
  return MONEY.format(n);
}

// ---------------------------------------------------------------- botón de arrepentimiento

/** Argentina no usa horario de verano: la hora oficial es UTC−3 todo el año. */
const AR_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Días corridos que tiene la clienta para arrepentirse (Ley 24.240, art. 34; Res. 424/2020). */
export const WITHDRAWAL_DAYS = 10;

/** Plazo para informar el código de trámite a la clienta. */
export const WITHDRAWAL_CODE_DEADLINE_HOURS = 24;

/**
 * Último instante para pedir el arrepentimiento: fin del día 10 corrido contado desde
 * el día de la entrega, en hora argentina.
 */
export function withdrawalDeadline(deliveredAt: Millis): Millis {
  const localMidnight = Math.floor((deliveredAt + AR_OFFSET_MS) / DAY_MS) * DAY_MS - AR_OFFSET_MS;
  return localMidnight + (WITHDRAWAL_DAYS + 1) * DAY_MS - 1;
}

export function canRequestWithdrawal(
  order: { status: OrderStatus; deliveredAt: Millis | null },
  now: Millis,
): boolean {
  if (order.status !== 'entregado' || order.deliveredAt == null) return false;
  return now <= withdrawalDeadline(order.deliveredAt);
}

// ---------------------------------------------------------------- identificadores

/** Sin 0/O ni 1/I/L, para que se puedan dictar por teléfono sin confusiones. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Genera un código legible. `random` devuelve números en [0, 1); en el servidor usar crypto. */
export function readableCode(length: number, random: () => number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET.charAt(Math.floor(random() * CODE_ALPHABET.length));
  }
  return out;
}
