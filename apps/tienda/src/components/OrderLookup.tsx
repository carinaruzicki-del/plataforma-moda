'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { callFn, errorMessage } from '@/lib/firebase';
import { savedOrders, type SavedOrder } from '@/lib/my-orders';
import { useStore } from '@/lib/store-context';

/** Encontrar un pedido sin cuenta: los de este dispositivo, o pedir el link por email. */
export function OrderLookup() {
  const { store, href } = useStore();
  const [saved, setSaved] = useState<SavedOrder[]>([]);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (store) setSaved(savedOrders(store.id));
  }, [store]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!store) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await callFn('sendOrderLink', { storeId: store.id, number: String(f.get('number') ?? ''), email: String(f.get('email') ?? '') });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {saved.length > 0 && (
        <div className="panel">
          <h2 style={{ fontSize: 20 }}>Pedidos hechos desde este dispositivo</h2>
          {saved.map((o) => (
            <Link key={o.orderId} className="btn ghost" style={{ justifyContent: 'space-between' }} href={href(`/pedido/${o.orderId}?t=${encodeURIComponent(o.token)}`)}>
              <span>Pedido <b>{o.number}</b></span>
              <span className="small muted">{new Date(o.at).toLocaleDateString('es-AR')}</span>
            </Link>
          ))}
        </div>
      )}
      <form className="panel" onSubmit={submit}>
        <h2 style={{ fontSize: 20 }}>Te mandamos el link de tu pedido</h2>
        <p className="small muted" style={{ margin: 0 }}>Escribí el número de pedido (está en el email de compra) y el email con el que compraste.</p>
        <div className="two">
          <div className="field"><label htmlFor="number">Número de pedido</label><input id="number" name="number" required placeholder="Ej.: K7M2QX" style={{ textTransform: 'uppercase' }} /></div>
          <div className="field"><label htmlFor="email">Email de la compra</label><input id="email" name="email" type="email" required /></div>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        {sent ? (
          <div className="note">Si los datos coinciden con un pedido, en unos minutos te llega un email con el link. Revisá también la carpeta de spam.</div>
        ) : (
          <button className="btn" disabled={busy}>{busy ? 'Enviando…' : 'Enviarme el link'}</button>
        )}
      </form>
    </div>
  );
}
