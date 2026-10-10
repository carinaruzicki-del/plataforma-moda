import { describe, expect, it } from 'vitest';
import { formatCuit, isValidCuit, missingFiscal, priceWithoutTaxes } from '../src';

describe('datos fiscales', () => {
  it('valida el dígito verificador del CUIT', () => {
    expect(isValidCuit('20-12345678-6')).toBe(true);
    expect(isValidCuit('20123456786')).toBe(true);
    expect(isValidCuit('20-12345678-5')).toBe(false);
    expect(isValidCuit('99-12345678-6')).toBe(false);
    expect(isValidCuit('123')).toBe(false);
    expect(formatCuit('20123456786')).toBe('20-12345678-6');
  });

  it('precio sin impuestos solo para Responsable Inscripto', () => {
    expect(priceWithoutTaxes(38750, { taxStatus: 'responsable_inscripto' })).toBe(32024.79);
    expect(priceWithoutTaxes(38750, { taxStatus: 'monotributo' })).toBeNull();
    expect(priceWithoutTaxes(38750, undefined)).toBeNull();
  });

  it('dice qué datos faltan', () => {
    expect(missingFiscal(undefined)).toEqual(['razón social', 'CUIT', 'domicilio', 'condición frente al IVA']);
    expect(missingFiscal({ legalName: 'Ana', cuit: '20123456786', address: 'X 1', taxStatus: 'monotributo' })).toEqual([]);
  });
});
