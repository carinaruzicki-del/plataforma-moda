import { describe, expect, it } from 'vitest';
import {
  canRequestWithdrawal,
  canTransition,
  computeTotals,
  needsRefund,
  readableCode,
  stockEffect,
  withdrawalDeadline,
} from '../src';

describe('estados del pedido', () => {
  it('solo el sistema marca un pedido como pagado', () => {
    expect(canTransition('pago_pendiente', 'pagado', 'sistema')).toBe(true);
    expect(canTransition('pago_pendiente', 'pagado', 'comercio')).toBe(false);
    expect(canTransition('pago_pendiente', 'pagado', 'clienta')).toBe(false);
  });

  it('la clienta puede cancelar antes del envío, no después', () => {
    expect(canTransition('pagado', 'cancelado', 'clienta')).toBe(true);
    expect(canTransition('en_preparacion', 'cancelado', 'clienta')).toBe(true);
    expect(canTransition('despachado', 'cancelado', 'clienta')).toBe(false);
    expect(canTransition('entregado', 'cancelado', 'clienta')).toBe(false);
  });

  it('no se puede saltear la preparación', () => {
    expect(canTransition('pagado', 'despachado', 'comercio')).toBe(false);
  });

  it('cada cambio tiene su efecto sobre el stock', () => {
    expect(stockEffect('pago_pendiente', 'pagado')).toBe('commit');
    expect(stockEffect('pago_pendiente', 'cancelado')).toBe('release');
    expect(stockEffect('en_preparacion', 'cancelado')).toBe('restock');
    expect(stockEffect('devolucion', 'reembolsado')).toBe('restock');
    expect(stockEffect('pagado', 'en_preparacion')).toBeNull();
  });

  it('cancelar un pedido pagado requiere reembolso; uno sin pagar, no', () => {
    expect(needsRefund('pagado', 'cancelado')).toBe(true);
    expect(needsRefund('pago_pendiente', 'cancelado')).toBe(false);
  });
});

describe('totales', () => {
  it('calcula la comisión solo sobre los productos', () => {
    const t = computeTotals(
      [
        { unitPrice: 42000, quantity: 1 },
        { unitPrice: 29990.5, quantity: 2 },
      ],
      5000,
      3,
    );
    expect(t.subtotal).toBe(101981);
    expect(t.total).toBe(106981);
    expect(t.platformFee).toBe(3059.43);
  });

  it('rechaza pedidos vacíos o con cantidades inválidas', () => {
    expect(() => computeTotals([], 0, 3)).toThrow();
    expect(() => computeTotals([{ unitPrice: 100, quantity: 0 }], 0, 3)).toThrow();
    expect(() => computeTotals([{ unitPrice: 100, quantity: 1.5 }], 0, 3)).toThrow();
  });
});

describe('botón de arrepentimiento', () => {
  // Entregado el 1/10/2026 a las 22:00 hora argentina (2/10 01:00 UTC).
  const delivered = Date.parse('2026-10-02T01:00:00Z');

  it('el plazo vence al terminar el día 10 corrido, en hora argentina', () => {
    expect(new Date(withdrawalDeadline(delivered)).toISOString()).toBe('2026-10-12T02:59:59.999Z');
  });

  it('se puede pedir dentro del plazo y no después', () => {
    const order = { status: 'entregado' as const, deliveredAt: delivered };
    expect(canRequestWithdrawal(order, Date.parse('2026-10-11T23:00:00-03:00'))).toBe(true);
    expect(canRequestWithdrawal(order, Date.parse('2026-10-12T00:00:01-03:00'))).toBe(false);
  });

  it('no aplica a pedidos que no fueron entregados', () => {
    expect(canRequestWithdrawal({ status: 'despachado', deliveredAt: null }, delivered)).toBe(false);
  });
});

describe('códigos legibles', () => {
  it('no usa caracteres que se confunden', () => {
    let i = 0;
    const code = readableCode(200, () => (i++ % 97) / 97);
    expect(code).toHaveLength(200);
    expect(code).not.toMatch(/[01OIL]/);
  });
});
