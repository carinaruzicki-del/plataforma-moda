import { describe, expect, it } from 'vitest';
import { applyStock, available, groupByProduct, StockError, type Variant } from '../src';

const v = (sku: string, stock: number, reserved = 0): Variant => ({ sku, size: sku, stock, reserved });

describe('stock', () => {
  it('reservar aparta unidades sin tocar el stock físico', () => {
    const out = applyStock([v('M', 3)], [{ sku: 'M', quantity: 2 }], 'reserve');
    expect(out[0]).toMatchObject({ stock: 3, reserved: 2 });
    expect(available(out[0]!)).toBe(1);
  });

  it('no deja reservar más de lo disponible', () => {
    expect(() => applyStock([v('M', 3, 2)], [{ sku: 'M', quantity: 2 }], 'reserve')).toThrow(StockError);
  });

  it('confirmar el pago descuenta lo reservado', () => {
    const out = applyStock([v('M', 3, 2)], [{ sku: 'M', quantity: 2 }], 'commit');
    expect(out[0]).toMatchObject({ stock: 1, reserved: 0 });
  });

  it('liberar devuelve lo reservado; reponer suma stock', () => {
    expect(applyStock([v('M', 3, 2)], [{ sku: 'M', quantity: 2 }], 'release')[0]).toMatchObject({ stock: 3, reserved: 0 });
    expect(applyStock([v('M', 1)], [{ sku: 'M', quantity: 2 }], 'restock')[0]).toMatchObject({ stock: 3, reserved: 0 });
  });

  it('no modifica las variantes originales', () => {
    const original = [v('M', 3)];
    applyStock(original, [{ sku: 'M', quantity: 1 }], 'reserve');
    expect(original[0]!.reserved).toBe(0);
  });

  it('agrupa líneas por prenda y suma el mismo talle', () => {
    const g = groupByProduct([
      { productId: 'a', sku: 'M', quantity: 1 },
      { productId: 'a', sku: 'M', quantity: 2 },
      { productId: 'b', sku: 'S', quantity: 1 },
    ]);
    expect(g.get('a')).toEqual([{ sku: 'M', quantity: 3 }]);
    expect(g.get('b')).toEqual([{ sku: 'S', quantity: 1 }]);
  });
});
