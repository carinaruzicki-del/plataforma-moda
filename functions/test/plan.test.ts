import { DEFAULT_PLANS, type CheckoutInput, type Order, type Product, type Store } from '@plataforma/core';
import { describe, expect, it } from 'vitest';
import { buildPreference, planCheckout, planTransition, UserError } from '../src/orders/plan';

const now = Date.parse('2026-10-09T12:00:00Z');

const store: Store = {
  id: 's1',
  name: 'Alma Indumentaria',
  subdomain: 'alma',
  ownerUid: 'u-owner',
  plan: 'inicial',
  status: 'activa',
  contact: { email: 'hola@alma.test' },
  pickup: { enabled: true, address: 'Av. Siempre Viva 123', hours: 'Lun a Sáb 10 a 19' },
  flatShipping: { enabled: true, zones: [{ id: 'caba', name: 'CABA', price: 5000, provinces: ['CABA'] }] },
  mpConnected: true,
  createdAt: 0,
  updatedAt: 0,
};

const blusa: Product = {
  id: 'blusa',
  storeId: 's1',
  name: 'Blusa Alba',
  description: '',
  category: 'Arriba',
  line: 'Mujer',
  color: 'Marfil',
  fit: 'Regular',
  styles: ['Elegante'],
  occasions: ['Cena'],
  price: 42000,
  media: [{ path: 'stores/s1/media/blusa.jpg', type: 'image' }],
  variants: [
    { sku: 'BA-S', size: 'S', stock: 1, reserved: 0 },
    { sku: 'BA-M', size: 'M', stock: 3, reserved: 1 },
  ],
  sectionIds: [],
  published: true,
  createdAt: 0,
  updatedAt: 0,
};

const input: CheckoutInput = {
  storeId: 's1',
  items: [{ productId: 'blusa', sku: 'BA-M', quantity: 2 }],
  customer: { name: 'Ana', email: 'Ana@Example.com', phone: '1155556666' },
  delivery: { method: 'retiro' },
};

const products = () => new Map([['blusa', structuredClone(blusa)]]);

function checkout(over: Partial<Parameters<typeof planCheckout>[0]> = {}) {
  return planCheckout({
    input,
    store,
    products: products(),
    plan: DEFAULT_PLANS.inicial,
    customerUid: null,
    now,
    random: () => 0.5,
    accessToken: 'tok',
    ...over,
  });
}

describe('planCheckout', () => {
  it('usa el precio de la base y aparta el stock', () => {
    const tampered = { ...input, items: [{ ...input.items[0]!, unitPrice: 1 }] } as unknown as CheckoutInput;
    const { order, variantsByProduct } = checkout({ input: tampered });
    expect(order.items[0]!.unitPrice).toBe(42000);
    expect(order.totals).toMatchObject({ subtotal: 84000, shipping: 0, total: 84000, platformFee: 2520 });
    expect(variantsByProduct.get('blusa')!.find((v) => v.sku === 'BA-M')).toMatchObject({ stock: 3, reserved: 3 });
    expect(order.status).toBe('pago_pendiente');
    expect(order.reservationExpiresAt).toBe(now + 30 * 60_000);
    expect(order.customer.email).toBe('ana@example.com');
  });

  it('rechaza si no alcanza el stock disponible (descontando reservas)', () => {
    const big = { ...input, items: [{ productId: 'blusa', sku: 'BA-M', quantity: 3 }] };
    expect(() => checkout({ input: big })).toThrow(/Solo quedan 2/);
  });

  it('suma líneas repetidas antes de chequear stock', () => {
    const dup = {
      ...input,
      items: [
        { productId: 'blusa', sku: 'BA-S', quantity: 1 },
        { productId: 'blusa', sku: 'BA-S', quantity: 1 },
      ],
    };
    expect(() => checkout({ input: dup })).toThrow(UserError);
  });

  it('rechaza prendas ocultas o de otra tienda', () => {
    const hidden = new Map([['blusa', { ...structuredClone(blusa), published: false }]]);
    expect(() => checkout({ products: hidden })).toThrow(/ya no está disponible/);
    const other = new Map([['blusa', { ...structuredClone(blusa), storeId: 'otra' }]]);
    expect(() => checkout({ products: other })).toThrow(/ya no está disponible/);
  });

  it('calcula el envío con la dirección, sin usar la zona que manda el navegador', () => {
    const address = { street: 'Corrientes', number: '1234', city: 'CABA', province: 'CABA' as const, postalCode: 'C1043AAZ' };
    const env = { ...input, delivery: { method: 'envio_propio' as const, zoneId: 'luna', address } };
    expect(checkout({ input: env }).order.totals).toMatchObject({ shipping: 5000, total: 89000, platformFee: 2520 });
    const bad = { ...input, delivery: { method: 'envio_propio' as const, address: { ...address, province: 'Mendoza' as const, postalCode: '5500' } } };
    expect(() => checkout({ input: bad })).toThrow(/no hace envíos/);
  });

  it('no deja comprar si la tienda no conectó Mercado Pago o está suspendida', () => {
    expect(() => checkout({ store: { ...store, mpConnected: false } })).toThrow(/pagos/);
    expect(() => checkout({ store: { ...store, status: 'suspendida' } })).toThrow(/no está recibiendo/);
  });
});

function makeOrder(over: Partial<Order> = {}): Order {
  const { order } = checkout();
  return { ...order, id: 'o1', ...over };
}

describe('planTransition', () => {
  it('al pagar descuenta lo reservado', () => {
    const p = new Map([['blusa', { ...structuredClone(blusa), variants: [{ sku: 'BA-M', size: 'M', stock: 3, reserved: 3 }] }]]);
    const plan = planTransition({ order: makeOrder(), to: 'pagado', by: 'sistema', products: p, now: now + 1 });
    expect(plan.variantsByProduct.get('blusa')![0]).toMatchObject({ stock: 1, reserved: 1 });
    expect(plan.patch.status).toBe('pagado');
    expect(plan.patch.reservationExpiresAt).toBeNull();
    expect(plan.patch.history?.at(-1)).toMatchObject({ from: 'pago_pendiente', to: 'pagado', by: 'sistema' });
  });

  it('cancelar un pedido pagado repone stock y pide reembolso', () => {
    const order = makeOrder({ status: 'en_preparacion', payment: { provider: 'mercadopago', paymentId: '123' } });
    const plan = planTransition({ order, to: 'cancelado', by: 'clienta', products: products(), now });
    expect(plan.refund).toBe(true);
    expect(plan.variantsByProduct.get('blusa')!.find((v) => v.sku === 'BA-M')!.stock).toBe(5);
  });

  it('impide estados que no corresponden a la forma de entrega', () => {
    const order = makeOrder({ status: 'en_preparacion' });
    expect(() => planTransition({ order, to: 'despachado', by: 'comercio', products: products(), now })).toThrow(/retirar/);
  });

  it('impide que la clienta cancele un pedido despachado', () => {
    const order = makeOrder({ status: 'despachado', delivery: { method: 'envio_propio' } });
    expect(() => planTransition({ order, to: 'cancelado', by: 'clienta', products: products(), now })).toThrow(UserError);
  });

  it('registra la fecha de entrega para el plazo de arrepentimiento', () => {
    const order = makeOrder({ status: 'listo_para_retirar' });
    expect(planTransition({ order, to: 'entregado', by: 'comercio', products: products(), now }).patch.deliveredAt).toBe(now);
  });
});

describe('buildPreference', () => {
  it('arma el cobro con la comisión de la plataforma y la referencia del pedido', () => {
    const order = makeOrder();
    const pref = buildPreference({
      order,
      store,
      storeUrl: 'https://alma.ejemplo.com.ar',
      notificationUrl: 'https://fn.example/mpWebhook?store=s1',
      publicMediaUrl: (p) => `https://cdn.example/${p}`,
    });
    expect(pref.marketplace_fee).toBe(2520);
    expect(pref.external_reference).toBe('s1/o1');
    expect(pref.items[0]).toMatchObject({ unit_price: 42000, quantity: 2, currency_id: 'ARS' });
    expect(pref.items[0]!.picture_url).toBe('https://cdn.example/stores/s1/media/blusa.jpg');
    expect(pref.back_urls.success).toBe('https://alma.ejemplo.com.ar/pedido/o1?t=tok');
    expect(pref.expiration_date_to).toBe(new Date(now + 30 * 60_000).toISOString());
    expect(pref.shipments).toBeUndefined();
  });
});

describe('buildPreference sin URL pública de fotos', () => {
  it('omite la foto en vez de mandar una URL inválida', () => {
    const pref = buildPreference({
      order: makeOrder(),
      store,
      storeUrl: 'https://alma.ejemplo.com.ar',
      notificationUrl: 'https://fn.example/mpWebhook?store=s1',
      publicMediaUrl: () => '',
    });
    expect(pref.items[0]!.picture_url).toBeUndefined();
  });
});
