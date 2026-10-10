'use client';

import { useState, type FormEvent } from 'react';
import { callFn, errorMessage } from '@/lib/firebase';
import { useStore } from '@/lib/store-context';

/** Respaldo para quien compró sin cuenta desde otro dispositivo: pide el acceso por email. */
export function OrderLookup() {
  const { store } = useStore();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      <form className="stack" onSubmit={submit} style={{ marginTop: 12 }}>
                <p className="small muted" style={{ margin: 0 }}>Escribí el número de pedido (está en el email de compra) y el email con el que compraste. Te mandamos el acceso a ese pedido.</p>
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
