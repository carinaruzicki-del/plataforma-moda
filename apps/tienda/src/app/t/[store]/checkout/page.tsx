'use client';

import { available, computeTotals, formatPesos, type CheckoutInput } from '@plataforma/core';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { callFn, errorMessage } from '@/lib/firebase';
import { saveOrder } from '@/lib/my-orders';
import { useStore } from '@/lib/store-context';

interface CheckoutResult {
  orderId: string;
  number: string;
  accessToken: string;
  checkoutUrl: string;
  sandboxCheckoutUrl: string;
}

const PROVINCES = [
  'CABA', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa',
  'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

export default function CheckoutPage() {
  const { store, cart, productById, href, clearCart } = useStore();
  const pickup = store?.pickup?.enabled ? store.pickup : null;
  const zones = store?.flatShipping?.enabled ? store.flatShipping.zones : [];
  const [method, setMethod] = useState<'retiro' | 'envio_propio'>(pickup ? 'retiro' : 'envio_propio');
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!store) return null;
  const lines = cart
    .map((l) => ({ ...l, p: productById(l.productId) }))
    .filter((l) => l.p && l.p.variants.some((v) => v.sku === l.sku && available(v) >= l.quantity));
  if (!lines.length) {
    return <div className="center"><h1 style={{ fontSize: 28 }}>No hay prendas para comprar</h1><Link className="btn" href={href('/carrito')}>Volver al carrito</Link></div>;
  }
  if (!pickup && !zones.length) {
    return <div className="center"><h1 style={{ fontSize: 28 }}>Esta tienda todavía no configuró las entregas</h1><p className="muted">Escribile al local para coordinar tu compra.</p></div>;
  }

  const shipping = method === 'envio_propio' ? zones.find((z) => z.id === zoneId)?.price ?? 0 : 0;
  const totals = computeTotals(lines.map((l) => ({ unitPrice: l.p!.price, quantity: l.quantity })), shipping, 0);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!store) return;
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? '').trim();
    const input: CheckoutInput = {
      storeId: store.id,
      items: lines.map((l) => ({ productId: l.productId, sku: l.sku, quantity: l.quantity })),
      customer: { name: g('name'), email: g('email'), phone: g('phone') },
      delivery:
        method === 'retiro'
          ? { method: 'retiro' }
          : {
              method: 'envio_propio',
              zoneId,
              address: { street: g('street'), number: g('number'), floor: g('floor') || undefined, city: g('city'), province: g('province'), postalCode: g('postalCode'), notes: g('notes') || undefined },
            },
      ...(g('note') ? { note: g('note') } : {}),
    };
    setBusy(true);
    setError('');
    try {
      const r = await callFn<CheckoutInput, CheckoutResult>('createCheckout', input);
      saveOrder(store.id, { orderId: r.orderId, number: r.number, token: r.accessToken, at: Date.now() });
      clearCart();
      window.location.href = process.env.NEXT_PUBLIC_MP_SANDBOX === '1' ? r.sandboxCheckoutUrl : r.checkoutUrl;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="layout-2" onSubmit={submit}>
      <section className="panel">
        <h1 style={{ fontSize: 28 }}>Finalizar compra</h1>
        <div className="two">
          <div className="field"><label htmlFor="name">Nombre y apellido</label><input id="name" name="name" required autoComplete="name" /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
          <div className="field"><label htmlFor="phone">Teléfono</label><input id="phone" name="phone" type="tel" required autoComplete="tel" placeholder="11 5555 6666" /></div>
        </div>

        <h2 style={{ fontSize: 20 }}>Entrega</h2>
        <div className="stack" role="radiogroup">
          {pickup && (
            <label className={`radio-card${method === 'retiro' ? ' on' : ''}`}>
              <input type="radio" name="method" checked={method === 'retiro'} onChange={() => setMethod('retiro')} />
              <span><b>Retiro en el local · gratis</b><br /><span className="small muted">{pickup.address} · {pickup.hours}</span></span>
            </label>
          )}
          {zones.length > 0 && (
            <label className={`radio-card${method === 'envio_propio' ? ' on' : ''}`}>
              <input type="radio" name="method" checked={method === 'envio_propio'} onChange={() => setMethod('envio_propio')} />
              <span><b>Envío a domicilio</b><br /><span className="small muted">El local te avisa cuando lo despacha.</span></span>
            </label>
          )}
        </div>

        {method === 'envio_propio' && (
          <>
            <div className="field">
              <label htmlFor="zone">Zona</label>
              <select id="zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name} · {formatPesos(z.price)}</option>)}
              </select>
            </div>
            <div className="two">
              <div className="field"><label htmlFor="street">Calle</label><input id="street" name="street" required autoComplete="address-line1" /></div>
              <div className="field"><label htmlFor="number">Número</label><input id="number" name="number" required /></div>
              <div className="field"><label htmlFor="floor">Piso y depto (opcional)</label><input id="floor" name="floor" /></div>
              <div className="field"><label htmlFor="city">Localidad</label><input id="city" name="city" required autoComplete="address-level2" /></div>
              <div className="field"><label htmlFor="province">Provincia</label><select id="province" name="province" required defaultValue="">{['', ...PROVINCES].map((p) => <option key={p} value={p} disabled={!p}>{p || 'Elegí la provincia'}</option>)}</select></div>
              <div className="field"><label htmlFor="postalCode">Código postal</label><input id="postalCode" name="postalCode" required autoComplete="postal-code" placeholder="1425 o C1425ABC" /></div>
            </div>
            <div className="field"><label htmlFor="notes">Indicaciones para la entrega (opcional)</label><input id="notes" name="notes" placeholder="Timbre, horario, entre calles…" /></div>
          </>
        )}
        <div className="field"><label htmlFor="note">Nota para el local (opcional)</label><textarea id="note" name="note" placeholder="Ej.: es para regalo" /></div>
      </section>

      <aside className="panel">
        <h2 style={{ fontSize: 20 }}>Tu pedido</h2>
        {lines.map((l) => {
          const v = l.p!.variants.find((x) => x.sku === l.sku)!;
          return <div key={l.sku} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }} className="small"><span>{l.p!.name} · {v.size} × {l.quantity}</span><span className="num">{formatPesos(l.p!.price * l.quantity)}</span></div>;
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small"><span>Envío</span><span className="num">{shipping ? formatPesos(shipping) : 'Gratis'}</span></div>
        <div className="total-row"><span>Total</span><span className="num">{formatPesos(totals.total)}</span></div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Preparando el pago…' : 'Pagar con Mercado Pago'}</button>
        <p className="small muted" style={{ margin: 0 }}>Apartamos tus prendas por 30 minutos mientras pagás. Te mandamos el detalle por email.</p>
      </aside>
    </form>
  );
}
