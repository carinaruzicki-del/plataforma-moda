import { describe, expect, it } from 'vitest';
import { checkoutInputSchema, productInputSchema, subdomainSchema, suggestSubdomain } from '../src';

describe('subdominios', () => {
  it('sugiere una dirección a partir del nombre', () => {
    expect(suggestSubdomain('Alma Indumentaria')).toBe('alma-indumentaria');
    expect(suggestSubdomain('  Ñandú & Co.  ')).toBe('nandu-co');
  });

  it('acepta direcciones válidas y rechaza reservadas o mal formadas', () => {
    expect(subdomainSchema.safeParse('alma-indumentaria').success).toBe(true);
    expect(subdomainSchema.safeParse('admin').success).toBe(false);
    expect(subdomainSchema.safeParse('-alma').success).toBe(false);
    expect(subdomainSchema.safeParse('Alma').success).toBe(false);
    expect(subdomainSchema.safeParse('al').success).toBe(false);
  });
});

describe('prendas', () => {
  const base = {
    name: 'Blusa Alba',
    category: 'Arriba',
    line: 'Mujer',
    color: 'Marfil',
    fit: 'Regular',
    price: 42000,
    media: [{ path: 'stores/s1/media/a.jpg', type: 'image' }],
    variants: [{ sku: 'BA-M', size: 'M', stock: 2 }],
  };

  it('acepta una prenda completa', () => {
    expect(productInputSchema.safeParse(base).success).toBe(true);
  });

  it('pide foto para publicar y calce en prendas que lo tienen', () => {
    expect(productInputSchema.safeParse({ ...base, media: [] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, media: [], published: false }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...base, fit: null }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, category: 'Accesorio', fit: null }).success).toBe(true);
  });

  it('rechaza talles repetidos', () => {
    const r = productInputSchema.safeParse({
      ...base,
      variants: [
        { sku: 'a', size: 'M', stock: 1 },
        { sku: 'b', size: 'M', stock: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe('checkout', () => {
  it('exige dirección para envío y no para retiro', () => {
    const base = {
      storeId: 's1',
      items: [{ productId: 'p', sku: 'M', quantity: 1 }],
      customer: { name: 'Ana', email: 'ana@example.com', phone: '1155556666' },
    };
    expect(checkoutInputSchema.safeParse({ ...base, delivery: { method: 'retiro' } }).success).toBe(true);
    expect(checkoutInputSchema.safeParse({ ...base, delivery: { method: 'envio_propio', zoneId: 'caba' } }).success).toBe(false);
    expect(
      checkoutInputSchema.safeParse({
        ...base,
        delivery: {
          method: 'envio_propio',
          zoneId: 'caba',
          address: { street: 'Corrientes', number: '1234', city: 'CABA', province: 'CABA', postalCode: 'C1043AAZ' },
        },
      }).success,
    ).toBe(true);
  });
});
