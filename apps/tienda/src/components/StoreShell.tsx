'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { StoreProvider, useStore } from '@/lib/store-context';
import { mediaUrl } from '@/lib/media';
import { ToastProvider } from './Toast';

const ICONS = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>,
  catalog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 4l4 2 4-2 4 3-2 4-2-1v10H8V10l-2 1-2-4z" /></svg>,
  stylist: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" /></svg>,
  cart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8zM9 8V6a3 3 0 0 1 6 0v2" /></svg>,
};

function Chrome({ children }: { children: ReactNode }) {
  const { status, store, href, cart, base } = useStore();
  const path = usePathname() ?? '/';
  const rel = base && path.startsWith(base) ? path.slice(base.length) || '/' : path;
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  useEffect(() => {
    if (store) {
      document.title = store.name;
      if (store.accentColor) document.documentElement.style.setProperty('--accent', store.accentColor);
    }
  }, [store]);

  if (status === 'cargando') {
    return <div className="wrap center"><b style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Abriendo la tienda…</b></div>;
  }
  if (status === 'no_existe' || !store) {
    return (
      <div className="wrap center">
        <h1 style={{ fontSize: 30 }}>No encontramos esta tienda</h1>
        <p className="muted">Revisá la dirección o pedile el link al local.</p>
      </div>
    );
  }
  if (status === 'error') {
    return <div className="wrap center"><h1 style={{ fontSize: 28 }}>No pudimos cargar la tienda</h1><p className="muted">Revisá tu conexión y recargá la página.</p></div>;
  }

  const is = (p: string) => (p === '/' ? rel === '/' : rel.startsWith(p));
  const nav: Array<[string, string]> = [
    ['/', 'Inicio'],
    ['/productos', 'Prendas'],
    ['/que-me-pongo', '¿Qué me pongo?'],
  ];

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Link className="brand" href={href('/')}>
            {store.logoPath ? <img src={mediaUrl(store.logoPath)} alt="" /> : <span className="brand-mark" aria-hidden>{store.name.charAt(0)}</span>}
            <span className="brand-name">{store.name}</span>
          </Link>
          <nav className="nav" aria-label="Secciones de la tienda">
            {nav.map(([p, l]) => (
              <Link key={p} href={href(p)} className={is(p) ? 'on' : ''}>{l}</Link>
            ))}
          </nav>
          <Link href={href('/carrito')} className="btn ghost sm cart-link">
            Carrito <span className="count num">{count}</span>
          </Link>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="wrap footer">
        <span>
          {store.name}
          {store.contact.whatsapp ? ` · WhatsApp ${store.contact.whatsapp}` : ''}
          {store.contact.instagram ? ` · @${store.contact.instagram.replace(/^@/, '')}` : ''}
        </span>
        <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href={href('/pedido')}>Mi pedido</Link>
          {/* Resolución 424/2020: acceso directo y visible desde todas las páginas. */}
          <Link href={href('/arrepentimiento')} className="regret">Botón de arrepentimiento</Link>
        </span>
      </footer>
      <nav className="tabbar" aria-label="Navegación">
        <Link href={href('/')} className={is('/') ? 'on' : ''}>{ICONS.home}Inicio</Link>
        <Link href={href('/productos')} className={is('/productos') || is('/seccion') ? 'on' : ''}>{ICONS.catalog}Prendas</Link>
        <Link href={href('/que-me-pongo')} className={is('/que-me-pongo') ? 'on' : ''}>{ICONS.stylist}¿Qué me pongo?</Link>
        <Link href={href('/carrito')} className={is('/carrito') ? 'on' : ''}>
          {ICONS.cart}Carrito{count ? <span className="count num">{count}</span> : null}
        </Link>
      </nav>
    </>
  );
}

export function StoreShell({ subdomain, children }: { subdomain: string; children: ReactNode }) {
  return (
    <StoreProvider subdomain={subdomain}>
      <ToastProvider>
        <Chrome>{children}</Chrome>
      </ToastProvider>
    </StoreProvider>
  );
}
