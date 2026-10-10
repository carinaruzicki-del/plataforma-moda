'use client';

import { PROVINCES, type Address } from '@plataforma/core';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { accountErrorMessage, useAccount } from '@/lib/account';
import { useStore } from '@/lib/store-context';
import { MyOrders } from './MyOrders';
import { useToast } from './Toast';

/** A dónde volver después de iniciar sesión. Solo rutas propias de la tienda. */
const BACK: Record<string, string> = { checkout: '/checkout', pedido: '/pedido', 'que-me-pongo': '/que-me-pongo', carrito: '/carrito' };

export function AccountPage() {
  const { user } = useAccount();
  const { href } = useStore();
  const router = useRouter();
  const back = BACK[useSearchParams()?.get('volver') ?? ''];

  useEffect(() => {
    if (user && back) router.replace(href(back));
  }, [user, back, href, router]);

  if (user === undefined) return <div className="center muted">Cargando…</div>;
  return user ? <LoggedIn /> : <SignIn backToCheckout={back === '/checkout'} />;
}

function SignIn({ backToCheckout }: { backToCheckout: boolean }) {
  const { href } = useStore();
  const { login, register, loginWithGoogle, resetPassword } = useAccount();
  const [mode, setMode] = useState<'ingresar' | 'crear' | 'olvide'>('ingresar');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email') ?? '');
    const password = String(f.get('password') ?? '');
    if (mode === 'ingresar') void run(() => login(email, password));
    else if (mode === 'crear') void run(() => register(String(f.get('name') ?? ''), email, password));
    else
      void run(async () => {
        await resetPassword(email);
        setInfo('Si hay una cuenta con ese email, te llega un link para elegir una contraseña nueva. Revisá spam.');
      });
  }

  return (
    <div style={{ maxWidth: 440, margin: '36px auto 0' }} className="stack">
      <h1 style={{ fontSize: 32 }}>{mode === 'crear' ? 'Crear cuenta' : mode === 'olvide' ? 'Recuperar contraseña' : 'Ingresar'}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {backToCheckout
          ? 'Con tu cuenta completamos tus datos y tu dirección. También podés volver y comprar sin cuenta.'
          : 'Con tu cuenta ves todos tus pedidos, guardás tus direcciones y tus talles.'}
      </p>

      {mode !== 'olvide' && (
        <>
          <button className="btn ghost block" disabled={busy} onClick={() => void run(loginWithGoogle)}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Seguir con Google
          </button>
          <div className="divider small muted"><span>o con tu email</span></div>
        </>
      )}

      <form className="panel" onSubmit={submit}>
        {mode === 'crear' && (
          <div className="field"><label htmlFor="name">Nombre y apellido</label><input id="name" name="name" required autoComplete="name" /></div>
        )}
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
        {mode !== 'olvide' && (
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" required minLength={6} autoComplete={mode === 'crear' ? 'new-password' : 'current-password'} />
          </div>
        )}
        {mode === 'crear' && (
          <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" name="acepto" required style={{ marginTop: 3 }} />
            <span>
              Leí y acepto los <Link className="link" href={href('/legales#terminos')} target="_blank">términos</Link> y
              la <Link className="link" href={href('/legales#privacidad')} target="_blank">política de privacidad</Link>.
            </span>
          </label>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        {info && <div className="note">{info}</div>}
        <button className="btn block" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'crear' ? 'Crear cuenta' : mode === 'olvide' ? 'Mandarme el link' : 'Ingresar'}
        </button>
        <div className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          {mode === 'ingresar' ? (
            <>
              <button type="button" className="link" onClick={() => setMode('crear')}>Crear una cuenta</button>
              <button type="button" className="link" onClick={() => setMode('olvide')}>Olvidé mi contraseña</button>
            </>
          ) : (
            <button type="button" className="link" onClick={() => setMode('ingresar')}>Ya tengo cuenta</button>
          )}
        </div>
      </form>
    </div>
  );
}

function LoggedIn() {
  const { user, profile, saveProfile, logout } = useAccount();
  const toast = useToast();
  const [tab, setTab] = useState<'pedidos' | 'datos' | 'direcciones'>('pedidos');
  const [busy, setBusy] = useState(false);
  const name = profile?.name || user?.displayName || '';

  async function save(patch: Parameters<typeof saveProfile>[0], msg: string) {
    setBusy(true);
    try {
      await saveProfile(patch);
      toast(msg);
    } catch {
      toast('No se pudo guardar. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function submitData(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void save({ name: String(f.get('name') ?? '').trim(), phone: String(f.get('phone') ?? '').trim() }, 'Datos guardados');
  }

  function submitAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? '').trim();
    const a: Address = { street: get('street'), number: get('number'), city: get('city'), province: get('province'), postalCode: get('postalCode').toUpperCase() };
    if (get('floor')) a.floor = get('floor');
    void save({ addresses: [...(profile?.addresses ?? []), a] }, 'Dirección guardada').then(() => form.reset());
  }

  function removeAddress(i: number) {
    void save({ addresses: (profile?.addresses ?? []).filter((_, j) => j !== i) }, 'Dirección borrada');
  }

  return (
    <div style={{ maxWidth: 760, margin: '28px auto 0' }} className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">Mi cuenta</span>
          <h1 style={{ fontSize: 32 }}>Hola{name ? `, ${name.split(' ')[0]}` : ''}</h1>
          <p className="small muted" style={{ margin: 0 }}>{user?.email}</p>
        </div>
        <button className="btn ghost sm" onClick={() => void logout()}>Cerrar sesión</button>
      </div>

      <div className="chips" role="tablist">
        {(
          [
            ['pedidos', 'Mis pedidos'],
            ['datos', 'Mis datos'],
            ['direcciones', 'Direcciones'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'pedidos' && <MyOrders />}

      {tab === 'datos' && (
        <form className="panel" onSubmit={submitData} key={profile?.name ?? 'p'}>
          <div className="two">
            <div className="field"><label htmlFor="name">Nombre y apellido</label><input id="name" name="name" defaultValue={name} required autoComplete="name" /></div>
            <div className="field"><label htmlFor="phone">Teléfono</label><input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} autoComplete="tel" /></div>
          </div>
          <button className="btn" style={{ justifySelf: 'start' }} disabled={busy}>Guardar</button>
        </form>
      )}

      {tab === 'direcciones' && (
        <div className="stack">
          {(profile?.addresses ?? []).map((a, i) => (
            <div key={i} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="small">
                <b>{a.street} {a.number}{a.floor ? `, ${a.floor}` : ''}</b>
                <br />
                <span className="muted">{a.city}, {a.province} · CP {a.postalCode}</span>
              </span>
              <button className="btn danger sm" disabled={busy} onClick={() => removeAddress(i)}>Borrar</button>
            </div>
          ))}
          <form className="panel" onSubmit={submitAddress}>
            <h2 style={{ fontSize: 20 }}>Agregar dirección</h2>
            <div className="two">
              <div className="field"><label htmlFor="street">Calle</label><input id="street" name="street" required autoComplete="address-line1" /></div>
              <div className="field"><label htmlFor="number">Número</label><input id="number" name="number" required /></div>
              <div className="field"><label htmlFor="floor">Piso / depto (opcional)</label><input id="floor" name="floor" /></div>
              <div className="field"><label htmlFor="city">Localidad</label><input id="city" name="city" required autoComplete="address-level2" /></div>
              <div className="field">
                <label htmlFor="province">Provincia</label>
                <select id="province" name="province" required defaultValue="">
                  <option value="" disabled>Elegí</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="postalCode">Código postal</label><input id="postalCode" name="postalCode" required autoComplete="postal-code" /></div>
            </div>
            <button className="btn" style={{ justifySelf: 'start' }} disabled={busy}>Guardar dirección</button>
          </form>
        </div>
      )}
    </div>
  );
}
