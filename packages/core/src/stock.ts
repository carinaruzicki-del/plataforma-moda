import type { StockEffect } from './orders';
import type { Variant } from './types';

/** Unidades que se pueden vender ahora: las del local menos las apartadas por pedidos sin pagar. */
export function available(v: Pick<Variant, 'stock' | 'reserved'>): number {
  return Math.max(0, v.stock - v.reserved);
}

export function totalAvailable(variants: readonly Variant[]): number {
  return variants.reduce((s, v) => s + available(v), 0);
}

export class StockError extends Error {
  constructor(
    message: string,
    readonly sku: string,
    readonly availableUnits: number,
  ) {
    super(message);
    this.name = 'StockError';
  }
}

export interface StockLine {
  sku: string;
  quantity: number;
}

/**
 * Aplica el efecto de un cambio de estado sobre las variantes de UNA prenda y devuelve
 * las variantes nuevas. No modifica las originales. El servidor lo llama dentro de una
 * transacción de Firestore, así dos compras simultáneas no venden la misma unidad.
 *
 * - `reserve`: aparta unidades al crear el pedido; falla si no alcanzan.
 * - `commit`: el pago entró; descuenta del stock lo que estaba apartado.
 * - `release`: el pago no llegó; libera lo apartado.
 * - `restock`: vuelve mercadería al local (cancelación de un pedido pagado o devolución).
 */
export function applyStock(
  variants: readonly Variant[],
  lines: readonly StockLine[],
  effect: Exclude<StockEffect, null> | 'reserve',
): Variant[] {
  const next = variants.map((v) => ({ ...v }));
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new StockError('Cantidad inválida.', line.sku, 0);
    }
    const v = next.find((x) => x.sku === line.sku);
    if (!v) {
      if (effect === 'reserve') throw new StockError('Ese talle ya no existe.', line.sku, 0);
      // Si la variante se borró después de la compra, no hay stock que devolver ni liberar.
      continue;
    }
    switch (effect) {
      case 'reserve': {
        const free = available(v);
        if (free < line.quantity) {
          throw new StockError(
            free > 0 ? `Solo quedan ${free} unidades del talle ${v.size}.` : `No queda stock del talle ${v.size}.`,
            v.sku,
            free,
          );
        }
        v.reserved += line.quantity;
        break;
      }
      case 'commit':
        v.reserved = Math.max(0, v.reserved - line.quantity);
        v.stock = Math.max(0, v.stock - line.quantity);
        break;
      case 'release':
        v.reserved = Math.max(0, v.reserved - line.quantity);
        break;
      case 'restock':
        v.stock += line.quantity;
        break;
    }
  }
  return next;
}

/** Agrupa las líneas de un pedido por prenda, para tocar cada documento una sola vez. */
export function groupByProduct<T extends { productId: string; sku: string; quantity: number }>(
  items: readonly T[],
): Map<string, StockLine[]> {
  const out = new Map<string, StockLine[]>();
  for (const it of items) {
    const lines = out.get(it.productId) ?? [];
    const same = lines.find((l) => l.sku === it.sku);
    if (same) same.quantity += it.quantity;
    else lines.push({ sku: it.sku, quantity: it.quantity });
    out.set(it.productId, lines);
  }
  return out;
}
