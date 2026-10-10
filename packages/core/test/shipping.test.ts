import { describe, expect, it } from 'vitest';
import { provinceFromPostalCode, quoteShipping, type Store } from '../src';

const store: Pick<Store, 'flatShipping'> = {
  flatShipping: {
    enabled: true,
    zones: [
      { id: 'caba', name: 'CABA', price: 4000, provinces: ['CABA'], freeFrom: 150000 },
      { id: 'norte', name: 'GBA Norte', price: 5500, postalCodePrefixes: ['16'] },
      { id: 'bsas', name: 'Provincia de Buenos Aires', price: 6500, provinces: ['Buenos Aires'] },
      { id: 'resto', name: 'Resto del país', price: 9000 },
    ],
  },
};

describe('envíos', () => {
  it('deduce la provincia del código postal argentino', () => {
    expect(provinceFromPostalCode('c1425abc')).toBe('CABA');
    expect(provinceFromPostalCode('X5000ABC')).toBe('Córdoba');
    expect(provinceFromPostalCode('1425')).toBe('CABA');
    expect(provinceFromPostalCode('5000')).toBeNull();
  });

  it('elige la zona por prefijo, después provincia y por último el resto del país', () => {
    expect(quoteShipping(store, { province: 'Buenos Aires', postalCode: 'B1636ABC' })?.zone.id).toBe('norte');
    expect(quoteShipping(store, { province: 'Buenos Aires', postalCode: '1900' })?.zone.id).toBe('bsas');
    expect(quoteShipping(store, { province: 'Mendoza', postalCode: '5500' })?.zone.id).toBe('resto');
  });

  it('aplica el envío gratis desde el monto configurado', () => {
    expect(quoteShipping(store, { province: 'CABA' }, 100000)).toMatchObject({ price: 4000, free: false });
    expect(quoteShipping(store, { province: 'CABA' }, 150000)).toMatchObject({ price: 0, free: true });
  });

  it('sin envíos habilitados no cotiza', () => {
    expect(quoteShipping({ flatShipping: { enabled: false, zones: [] } }, { province: 'CABA' })).toBeNull();
  });
});
