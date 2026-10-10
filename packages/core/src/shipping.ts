import type { Pesos, ShippingZone, Store } from './types';

export const PROVINCES = [
  'CABA',
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const;
export type Province = (typeof PROVINCES)[number];

/** Primera letra del Código Postal Argentino (CPA) → provincia. Ej.: C1425ABC = CABA. */
const CPA_LETTER: Record<string, Province> = {
  A: 'Salta',
  B: 'Buenos Aires',
  C: 'CABA',
  D: 'San Luis',
  E: 'Entre Ríos',
  F: 'La Rioja',
  G: 'Santiago del Estero',
  H: 'Chaco',
  J: 'San Juan',
  K: 'Catamarca',
  L: 'La Pampa',
  M: 'Mendoza',
  N: 'Misiones',
  P: 'Formosa',
  Q: 'Neuquén',
  R: 'Río Negro',
  S: 'Santa Fe',
  T: 'Tucumán',
  U: 'Chubut',
  V: 'Tierra del Fuego',
  W: 'Corrientes',
  X: 'Córdoba',
  Y: 'Jujuy',
  Z: 'Santa Cruz',
};

export function normalizePostalCode(cp: string): string {
  return cp.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidPostalCode(cp: string): boolean {
  return /^([A-Z]\d{4}[A-Z]{3}|\d{4})$/.test(normalizePostalCode(cp));
}

/**
 * Provincia que se deduce del código postal, si se puede. El CPA (letra + 4 números + 3 letras)
 * la dice con certeza; de los códigos viejos de 4 números solo se deduce CABA (1000 a 1499).
 * Si devuelve null, hay que preguntarle la provincia a la clienta.
 */
export function provinceFromPostalCode(cp: string): Province | null {
  const n = normalizePostalCode(cp);
  if (/^[A-Z]\d{4}/.test(n)) return CPA_LETTER[n.charAt(0)] ?? null;
  if (/^\d{4}$/.test(n)) {
    const num = Number(n);
    if (num >= 1000 && num <= 1499) return 'CABA';
  }
  return null;
}

/** Los 4 números del código postal (sirven para comparar códigos viejos y nuevos). */
function cpDigits(cp: string): string {
  const n = normalizePostalCode(cp);
  return /^[A-Z]\d{4}/.test(n) ? n.slice(1, 5) : n.slice(0, 4);
}

export interface ShippingQuote {
  zone: ShippingZone;
  price: Pesos;
  free: boolean;
}

/**
 * Elige la zona de envío para una dirección: primero la que coincide por prefijo de código
 * postal, después por provincia y por último la zona "resto del país" (sin provincias).
 */
export function quoteShipping(
  store: Pick<Store, 'flatShipping'>,
  dest: { province: string; postalCode?: string },
  subtotal = 0,
): ShippingQuote | null {
  if (!store.flatShipping?.enabled) return null;
  const zones = store.flatShipping.zones;
  const cp = dest.postalCode ? normalizePostalCode(dest.postalCode) : '';
  const digits = cp ? cpDigits(cp) : '';
  const byPrefix = cp
    ? zones.find((z) =>
        (z.postalCodePrefixes ?? []).some((p) => {
          const pre = normalizePostalCode(p);
          return pre && (cp.startsWith(pre) || digits.startsWith(pre));
        }),
      )
    : undefined;
  const byProvince = zones.find((z) => (z.provinces ?? []).includes(dest.province));
  const rest = zones.find((z) => !(z.provinces ?? []).length && !(z.postalCodePrefixes ?? []).length);
  const zone = byPrefix ?? byProvince ?? rest;
  if (!zone) return null;
  const free = zone.freeFrom != null && zone.freeFrom > 0 && subtotal >= zone.freeFrom;
  return { zone, price: free ? 0 : zone.price, free };
}
