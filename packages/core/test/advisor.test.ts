import { describe, expect, it } from 'vitest';
import { alternativesFor, recommendLooks, sortSizes, type AdvisorPrefs } from '../src';
import { product } from './fixtures';

const prefs: AdvisorPrefs = {
  line: 'Mujer',
  occasion: 'Cena',
  style: 'Elegante',
  fit: 'Regular',
  sizes: { upper: 'M', lower: '40' },
  budget: 200000,
};

const blusa = product({ id: 'blusa', name: 'Blusa', category: 'Arriba', price: 42000 });
const pantalon = product({
  id: 'pantalon',
  name: 'Pantalón',
  category: 'Abajo',
  price: 58000,
  variants: [{ sku: 'pant-40', size: '40', stock: 1, reserved: 0 }],
});
const cartera = product({
  id: 'cartera',
  name: 'Cartera',
  category: 'Accesorio',
  line: 'Unisex',
  fit: null,
  price: 30000,
  variants: [{ sku: 'cart-u', size: 'Único', stock: 3, reserved: 0 }],
});

describe('recommendLooks', () => {
  it('arma un look de arriba + abajo + accesorio con stock en el talle pedido', () => {
    const r = recommendLooks([blusa, pantalon, cartera], prefs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.looks[0]!.items.map((x) => x.product.id);
    expect(ids).toEqual(['blusa', 'pantalon', 'cartera']);
    expect(r.looks[0]!.total).toBe(130000);
    expect(r.looks[0]!.items[1]!.variant.size).toBe('40');
  });

  it('nunca recomienda una variante sin stock disponible (contando reservas)', () => {
    const reservado = { ...pantalon, variants: [{ sku: 'pant-40', size: '40', stock: 1, reserved: 1 }] };
    const r = recommendLooks([blusa, reservado], prefs);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('sin_combinacion');
  });

  it('ignora prendas no publicadas', () => {
    const r = recommendLooks([blusa, { ...pantalon, published: false }], prefs);
    expect(r.ok).toBe(false);
  });

  it('respeta el presupuesto: no suma extras que lo superen', () => {
    const r = recommendLooks([blusa, pantalon, cartera], { ...prefs, budget: 110000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.looks[0]!.items.map((x) => x.product.id)).toEqual(['blusa', 'pantalon']);
    expect(r.looks[0]!.total).toBeLessThanOrEqual(110000);
  });

  it('acepta calce vecino pero descarta calces lejanos', () => {
    const oversize = { ...blusa, id: 'over', fit: 'Oversize' as const };
    const holgado = { ...blusa, id: 'holg', fit: 'Holgado' as const };
    expect(recommendLooks([oversize, pantalon], prefs).ok).toBe(false);
    expect(recommendLooks([holgado, pantalon], prefs).ok).toBe(true);
  });

  it('incluye la prenda ancla en todos los looks', () => {
    const otraCartera = { ...cartera, id: 'cartera2', price: 20000 };
    const r = recommendLooks([blusa, pantalon, cartera, otraCartera], { ...prefs, anchorProductId: 'cartera' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const look of r.looks) expect(look.items.some((x) => x.product.id === 'cartera')).toBe(true);
  });

  it('explica cuando no hay prendas para la ocasión', () => {
    const r = recommendLooks([blusa, pantalon], { ...prefs, occasion: 'Fin de semana' });
    expect(r).toMatchObject({ ok: false, reason: 'sin_prendas_para_ocasion' });
  });

  it('explica cuando todo está sin stock', () => {
    const sinStock = { ...blusa, variants: [{ sku: 'x', size: 'M', stock: 0, reserved: 0 }] };
    const r = recommendLooks([sinStock], prefs);
    expect(r).toMatchObject({ ok: false, reason: 'sin_stock' });
  });

  it('con "Todas" separa looks de mujer y de hombre sin mezclarlos', () => {
    const camisa = product({ id: 'camisa', name: 'Camisa', category: 'Arriba', line: 'Hombre', price: 50000 });
    const chino = product({
      id: 'chino',
      name: 'Chino',
      category: 'Abajo',
      line: 'Hombre',
      price: 50000,
      variants: [{ sku: 'chino-40', size: '40', stock: 2, reserved: 0 }],
    });
    const r = recommendLooks([blusa, pantalon, camisa, chino], { ...prefs, line: 'Todas' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const look of r.looks) {
      for (const it of look.items) expect([look.line, 'Unisex']).toContain(it.product.line);
    }
    expect(new Set(r.looks.map((l) => l.line))).toEqual(new Set(['Mujer', 'Hombre']));
  });
});

describe('alternativesFor', () => {
  const pollera = product({
    id: 'pollera',
    name: 'Pollera',
    category: 'Abajo',
    price: 50000,
    variants: [{ sku: 'po-40', size: '40', stock: 1, reserved: 0 }],
  });
  const sinTalle = product({
    id: 'sin-talle',
    name: 'Pantalón 44',
    category: 'Abajo',
    price: 45000,
    variants: [{ sku: 'p44', size: '44', stock: 3, reserved: 0 }],
  });
  const hombre = product({
    id: 'chino',
    name: 'Chino',
    category: 'Abajo',
    line: 'Hombre',
    price: 40000,
    variants: [{ sku: 'ch-40', size: '40', stock: 3, reserved: 0 }],
  });

  it('ofrece otra prenda del mismo tipo, con stock en el talle y de la misma colección', () => {
    const all = [blusa, pantalon, cartera, pollera, sinTalle, hombre];
    const r = recommendLooks(all, prefs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const look = r.looks[0]!;
    const idx = look.items.findIndex((x) => x.product.category === 'Abajo');
    const alts = alternativesFor(all, prefs, look, idx);
    const other = look.items[idx]!.product.id === 'pantalon' ? 'pollera' : 'pantalon';
    expect(alts.map((a) => a.product.id)).toEqual([other]);
    expect(alts[0]!.variant.size).toBe('40');
  });

  it('no repite prendas que ya están en el look', () => {
    const r = recommendLooks([blusa, pantalon, cartera], prefs);
    if (!r.ok) throw new Error('sin looks');
    const idx = r.looks[0]!.items.findIndex((x) => x.product.id === 'pantalon');
    expect(alternativesFor([blusa, pantalon, cartera], prefs, r.looks[0]!, idx)).toEqual([]);
  });
});

describe('sortSizes', () => {
  it('ordena letras, números y talle único como en una tienda', () => {
    expect(sortSizes(['XL', '40', 'S', 'Único', '38', 'XS', '24'])).toEqual(['XS', 'S', 'XL', 'Único', '24', '38', '40']);
  });
});
