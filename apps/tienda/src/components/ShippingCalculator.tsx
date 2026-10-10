'use client';

import { formatPesos, isValidPostalCode, PROVINCES, provinceFromPostalCode, quoteShipping, type Province } from '@plataforma/core';
import { useState } from 'react';
import { useShippingDest } from '@/lib/shipping-dest';
import { useStore } from '@/lib/store-context';

/** "Calcular envío" como en cualquier tienda: código postal → precio y plazo. */
export function ShippingCalculator({ subtotal }: { subtotal: number }) {
  const { store } = useStore();
  const [dest, setDest] = useShippingDest();
  const [cp, setCp] = useState('');
  const [province, setProvince] = useState<Province | ''>('');
  const [editing, setEditing] = useState(false);
  if (!store) return null;
  const pickup = store.pickup?.enabled ? store.pickup : null;

  const showForm = editing || !dest.postalCode || !dest.province;
  const quote = dest.province ? quoteShipping(store, { province: dest.province, postalCode: dest.postalCode }, subtotal) : null;
  const needsProvince = isValidPostalCode(cp) && !provinceFromPostalCode(cp);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <b className="small">Envío</b>
      {showForm ? (
        <form
          className="stack"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValidPostalCode(cp)) return;
            const prov = provinceFromPostalCode(cp) ?? province;
            if (!prov) return;
            setDest({ postalCode: cp, province: prov });
            setEditing(false);
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              aria-label="Código postal"
              placeholder="Tu código postal"
              value={cp}
              onChange={(e) => setCp(e.target.value.toUpperCase())}
              style={{ flex: 1, minWidth: 0, border: '1px solid var(--line)', borderRadius: 11, padding: '10px 12px' }}
            />
            <button className="btn ghost sm" disabled={!isValidPostalCode(cp) || (needsProvince && !province)}>Calcular</button>
          </div>
          {needsProvince && (
            <select aria-label="Provincia" value={province} onChange={(e) => setProvince(e.target.value as Province)} style={{ border: '1px solid var(--line)', borderRadius: 11, padding: '10px 12px' }}>
              <option value="">¿En qué provincia?</option>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
          )}
          <a className="small link" href="https://www.correoargentino.com.ar/formularios/cpa" target="_blank" rel="noreferrer">No sé mi código postal</a>
        </form>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          <div className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>Envío a {dest.postalCode} ({dest.province})</span>
            <button className="link small" onClick={() => { setCp(dest.postalCode); setEditing(true); }}>Cambiar</button>
          </div>
          {quote ? (
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{quote.zone.name}{quote.zone.eta ? ` · ${quote.zone.eta}` : ''}</span>
              <b className="num">{quote.free ? 'Gratis' : formatPesos(quote.price)}</b>
            </div>
          ) : (
            <span className="small muted">{store.flatShipping?.enabled ? 'Esta tienda no hace envíos a esa zona.' : 'Esta tienda no hace envíos a domicilio.'}</span>
          )}
          {quote?.zone.freeFrom && !quote.free ? (
            <span className="small muted">Envío gratis desde {formatPesos(quote.zone.freeFrom)}.</span>
          ) : null}
        </div>
      )}
      {pickup && <span className="small muted">O retiralo gratis en {pickup.address}.</span>}
    </div>
  );
}
