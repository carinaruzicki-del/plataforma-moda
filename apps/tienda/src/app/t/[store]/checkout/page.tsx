'use client';

import {
  available,
  formatPesos,
  isValidPostalCode,
  PROVINCES,
  provinceFromPostalCode,
  quoteShipping,
  type Address,
  type CheckoutInput,
  type Province,
} from '@plataforma/core';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAccount } from '@/lib/account';
import { callFn, errorMessage } from '@/lib/firebase';
import { saveOrder } from '@/lib/my-orders';
import { useShippingDest } from '@/lib/shipping-dest';
import { useStore } from '@/lib/store-context';

interface CheckoutResult {
  orderId: string;
  number: string;
  accessToken: string;
  checkoutUrl: string;
  sandboxCheckoutUrl: string;
}

const emptyAddress: Address = { street: '', number: '', floor: '', city: '', province: '', postalCode: '', notes: '' };

/**
 * Checkout en una sola página: datos, entrega con el envío calculado por código postal, y pago.
 * Se puede comprar sin cuenta; con cuenta se completa solo.
 */
export default function CheckoutPage() {
  const { store, cart, productById, href, clearCart } = useStore();
  const { user, profile, saveProfile } = useAccount();
  const [dest, setDest] = useShippingDest();
  const pickup = store?.pickup?.enabled ? store.pickup : null;
  const shipOn = !!store?.flatShipping?.enabled && (store.flatShipping.zones.length ?? 0) > 0;
  const [method, setMethod] = useState<'retiro' | 'envio_propio'>('envio_propio');
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [note, setNote] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shipOn && pickup) setMethod('retiro');
  }, [shipOn, pickup]);

  // Datos de la cuenta y el código postal que ya calculó en el carrito.
  useEffect(() => {
    if (user) {
      setContact((c) => ({
        name: c.name || profile?.name || user.displayName || '',
        email: c.email || user.email || '',
        phone: c.phone || profile?.phone || '',
      }));
    }
    const saved = profile?.addresses?.[0];
    if (saved) setAddress((a) => (a.street ? a : { ...emptyAddress, ...saved }));
  }, [user, profile]);
  useEffect(() => {
    if (dest.postalCode) setAddress((a) => (a.postalCode ? a : { ...a, postalCode: dest.postalCode, province: dest.province || a.province }));
  }, [dest]);

  const lines = useMemo(
    () =>
      cart
        .map((l) => ({ ...l, p: productById(l.productId) }))
        .filter((l) => l.p && l.p.variants.some((v) => v.sku === l.sku && available(v) >= l.quantity)),
    [cart, productById],
  );
  const subtotal = lines.reduce((s, l) => s + l.p!.price * l.quantity, 0);
  const autoProvince = provinceFromPostalCode(address.postalCode);
  const province = (autoProvince ?? address.province) as Province | '';
  const quote = store && method === 'envio_propio' && province ? quoteShipping(store, { province, postalCode: address.postalCode }, subtotal) : null;
  const shipping = method === 'envio_propio' ? quote?.price ?? 0 : 0;
  const total = subtotal + shipping;

  if (!store) return null;
  if (!lines.length) {
    return <div className="center"><h1 style={{ fontSize: 28 }}>No hay prendas para comprar</h1><Link className="btn" href={href('/carrito')}>Volver al carrito</Link></div>;
  }
  if (!pickup && !shipOn) {
    return <div className="center"><h1 style={{ fontSize: 28 }}>Esta tienda todavía no configuró las entregas</h1><p className="muted">Escribile al local para coordinar tu compra.</p></div>;
  }

  const setA = (k: keyof Address) => (e: { target: { value: string } }) => setAddress({ ...address, [k]: e.target.value });
  const canShip = method === 'retiro' || (!!quote && isValidPostalCode(address.postalCode));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    if (method === 'envio_propio' && !quote) return setError('No hacemos envíos a esa dirección. Revisá el código postal o elegí retiro en el local.');
    const input: CheckoutInput = {
      storeId: store.id,
      items: lines.map((l) => ({ productId: l.productId, sku: l.sku, quantity: l.quantity })),
      customer: { name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim() },
      delivery:
        method === 'retiro'
          ? { method: 'retiro' }
          : {
              method: 'envio_propio',
              address: {
                street: address.street.trim(),
                number: address.number.trim(),
                ...(address.floor?.trim() ? { floor: address.floor.trim() } : {}),
                city: address.city.trim(),
                province: province as Province,
                postalCode: address.postalCode.trim().toUpperCase(),
                ...(address.notes?.trim() ? { notes: address.notes.trim() } : {}),
              },
            },
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    setBusy(true);
    setError('');
    try {
      const r = await callFn<CheckoutInput, CheckoutResult>('createCheckout', input);
      saveOrder(store.id, { orderId: r.orderId, number: r.number, token: r.accessToken, at: Date.now() });
      if (method === 'envio_propio') setDest({ postalCode: address.postalCode, province: province as Province });
      if (user) {
        const addr = input.delivery.method === 'envio_propio' ? input.delivery.address : null;
        await saveProfile({
          name: contact.name.trim(),
          phone: contact.phone.trim(),
          ...(addr && saveAddress ? { addresses: [addr, ...(profile?.addresses ?? []).filter((a) => a.street !== addr.street || a.number !== addr.number)].slice(0, 5) } : {}),
        }).catch(() => undefined);
      }
      clearCart();
      window.location.href = process.env.NEXT_PUBLIC_MP_SANDBOX === '1' ? r.sandboxCheckoutUrl : r.checkoutUrl;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="layout-2" onSubmit={submit}>
      <section className="stack">
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 22 }}>1. Tus datos</h2>
            {!user && <Link className="link small" href={href('/cuenta?volver=checkout')}>¿Tenés cuenta? Iniciá sesión</Link>}
          </div>
          <div className="two">
            <div className="field"><label htmlFor="name">Nombre y apellido</label><input id="name" required autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" required autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
            <div className="field"><label htmlFor="phone">Teléfono</label><input id="phone" type="tel" required autoComplete="tel" placeholder="11 5555 6666" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
          </div>
        </div>

        <div className="panel">
          <h2 style={{ fontSize: 22 }}>2. Entrega</h2>
          <div className="stack" role="radiogroup" style={{ gap: 10 }}>
            {shipOn && (
              <label className={`radio-card${method === 'envio_propio' ? ' on' : ''}`}>
                <input type="radio" name="method" checked={method === 'envio_propio'} onChange={() => setMethod('envio_propio')} />
                <span style={{ flex: 1 }}>
                  <b>Envío a domicilio</b>
                  <br />
                  <span className="small muted">
                    {quote ? `${quote.zone.name}${quote.zone.eta ? ` · ${quote.zone.eta}` : ''}` : 'Completá tu código postal para ver el costo.'}
                  </span>
                </span>
                <b className="num small">{quote ? (quote.free ? 'Gratis' : formatPesos(quote.price)) : ''}</b>
              </label>
            )}
            {pickup && (
              <label className={`radio-card${method === 'retiro' ? ' on' : ''}`}>
                <input type="radio" name="method" checked={method === 'retiro'} onChange={() => setMethod('retiro')} />
                <span style={{ flex: 1 }}><b>Retiro en el local</b><br /><span className="small muted">{pickup.address} · {pickup.hours}</span></span>
                <b className="small">Gratis</b>
              </label>
            )}
          </div>

          {method === 'envio_propio' && (
            <>
              {profile && profile.addresses.length > 1 && (
                <div className="field">
                  <label htmlFor="saved">Mis direcciones</label>
                  <select id="saved" onChange={(e) => { const a = profile.addresses[Number(e.target.value)]; if (a) setAddress({ ...emptyAddress, ...a }); }} defaultValue="0">
                    {profile.addresses.map((a, i) => <option key={`${a.street}-${a.number}-${i}`} value={i}>{a.street} {a.number}, {a.city}</option>)}
                  </select>
                </div>
              )}
              <div className="two">
                <div className="field">
                  <label htmlFor="postalCode">Código postal</label>
                  <input id="postalCode" required autoComplete="postal-code" placeholder="C1425ABC o 1425" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value.toUpperCase() })} />
                </div>
                <div className="field">
                  <label htmlFor="province">Provincia</label>
                  <select id="province" required value={province} disabled={!!autoProvince} onChange={setA('province')}>
                    <option value="" disabled>Elegí la provincia</option>
                    {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field"><label htmlFor="city">Localidad</label><input id="city" required autoComplete="address-level2" value={address.city} onChange={setA('city')} /></div>
                <div className="field"><label htmlFor="street">Calle</label><input id="street" required autoComplete="address-line1" value={address.street} onChange={setA('street')} /></div>
                <div className="field"><label htmlFor="number">Número</label><input id="number" required value={address.number} onChange={setA('number')} /></div>
                <div className="field"><label htmlFor="floor">Piso y depto (opcional)</label><input id="floor" value={address.floor ?? ''} onChange={setA('floor')} /></div>
              </div>
              <div className="field"><label htmlFor="notes">Indicaciones para la entrega (opcional)</label><input id="notes" placeholder="Timbre, horario, entre calles…" value={address.notes ?? ''} onChange={setA('notes')} /></div>
              {address.postalCode && isValidPostalCode(address.postalCode) && province && !quote && (
                <p className="error-text" style={{ margin: 0 }}>Esta tienda no hace envíos a esa zona. Podés elegir retiro en el local.</p>
              )}
              {user && <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Guardar esta dirección en mi cuenta</label>}
            </>
          )}
        </div>

        <div className="panel">
          <h2 style={{ fontSize: 22 }}>3. Pago</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Pagás con <b>Mercado Pago</b>: tarjeta de crédito (en cuotas según tu banco), débito, dinero en cuenta o efectivo en Rapipago y Pago Fácil. Te mandamos la confirmación por email.
          </p>
          <div className="field"><label htmlFor="note">Nota para el local (opcional)</label><textarea id="note" placeholder="Ej.: es para regalo" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
      </section>

      <aside className="panel" style={{ position: 'sticky', top: 84 }}>
        <h2 style={{ fontSize: 20 }}>Tu compra</h2>
        {lines.map((l) => {
          const v = l.p!.variants.find((x) => x.sku === l.sku)!;
          return <div key={l.sku} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }} className="small"><span>{l.p!.name} · {v.size} × {l.quantity}</span><span className="num">{formatPesos(l.p!.price * l.quantity)}</span></div>;
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small"><span>Subtotal</span><span className="num">{formatPesos(subtotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small">
          <span>Envío</span>
          <span className="num">{method === 'retiro' ? 'Gratis' : quote ? (quote.free ? 'Gratis' : formatPesos(quote.price)) : '—'}</span>
        </div>
        <div className="total-row"><span>Total</span><span className="num">{formatPesos(total)}</span></div>
        <p className="small muted" style={{ margin: 0 }}>Precio final con IVA incluido.</p>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn block" disabled={busy || !canShip}>{busy ? 'Preparando el pago…' : `Pagar ${formatPesos(total)}`}</button>
        <p className="small muted" style={{ margin: 0 }}>Apartamos tus prendas por 30 minutos mientras pagás.</p>
      </aside>
    </form>
  );
}
