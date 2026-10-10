import type { Pesos } from './types';

/**
 * Datos legales y fiscales de cada tienda. La tienda es la vendedora frente a la clienta
 * (Ley 24.240), así que sus datos tienen que estar visibles en el pie de todas las páginas.
 */
export type TaxStatus = 'responsable_inscripto' | 'monotributo' | 'exento';

export const TAX_STATUS_LABEL: Record<TaxStatus, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
};

export interface StoreFiscal {
  /** Razón social o nombre y apellido de la titular. */
  legalName: string;
  /** 11 dígitos, sin guiones. */
  cuit: string;
  /** Domicilio legal o comercial. */
  address: string;
  taxStatus: TaxStatus;
}

/** Valida el CUIT/CUIL con su dígito verificador. Acepta guiones y espacios. */
export function isValidCuit(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  if (!/^(20|23|24|25|26|27|30|33|34)\d{9}$/.test(d)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(d[10]);
}

export const formatCuit = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : raw;
};

/** IVA general. La ropa, el calzado y los accesorios van al 21 %. */
export const IVA_RATE = 0.21;

/**
 * "Precio sin impuestos nacionales" (Ley 27.743 art. 99 y Res. SIC 4/2025): precio final sin IVA.
 * Solo para Responsables Inscriptos, que son quienes discriminan IVA. Para Monotributo y Exento
 * devuelve null: cómo aplica el régimen en su caso lo tiene que confirmar un contador.
 */
export function priceWithoutTaxes(price: Pesos, fiscal: Pick<StoreFiscal, 'taxStatus'> | null | undefined): Pesos | null {
  if (fiscal?.taxStatus !== 'responsable_inscripto') return null;
  return Math.round((price / (1 + IVA_RATE)) * 100) / 100;
}

/** Faltantes que impiden mostrar los datos del vendedor completos. */
export function missingFiscal(f: Partial<StoreFiscal> | null | undefined): string[] {
  const out: string[] = [];
  if (!f?.legalName?.trim()) out.push('razón social');
  if (!f?.cuit || !isValidCuit(f.cuit)) out.push('CUIT');
  if (!f?.address?.trim()) out.push('domicilio');
  if (!f?.taxStatus) out.push('condición frente al IVA');
  return out;
}
