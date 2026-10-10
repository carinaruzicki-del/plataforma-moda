'use client';

import { normalizePostalCode, provinceFromPostalCode, type Province } from '@plataforma/core';
import { useEffect, useState } from 'react';

/** Código postal y provincia de la clienta, recordados en este dispositivo para cotizar el envío. */
export interface ShippingDest {
  postalCode: string;
  province: Province | '';
}

const KEY = 'envio:destino';

export function useShippingDest() {
  const [dest, setDestState] = useState<ShippingDest>({ postalCode: '', province: '' });
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null') as ShippingDest | null;
      if (v) setDestState(v);
    } catch {
      /* sin datos guardados */
    }
  }, []);
  const setDest = (d: ShippingDest) => {
    const postalCode = normalizePostalCode(d.postalCode);
    const next = { postalCode, province: provinceFromPostalCode(postalCode) ?? d.province };
    setDestState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* modo privado */
    }
  };
  return [dest, setDest] as const;
}
