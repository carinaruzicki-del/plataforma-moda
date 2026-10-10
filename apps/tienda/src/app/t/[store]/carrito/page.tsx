'use client';

import { available, formatPesos } from '@plataforma/core';
import Link from 'next/link';
import { MediaView } from '@/components/MediaView';
import { NetPrice } from '@/components/ProductDetail';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { coverOf } from '@/lib/media';
import { useStore } from '@/lib/store-context';

export default function CartPage() {
  const { cart, productById, setQuantity, href, clearCart } = useStore();
  const lines = cart.map((l) => {
    const p = productById(l.productId);
    const v = p?.variants.find((x) => x.sku === l.sku);
    return { ...l, p, v, left: v ? available(v) : 0 };
  });
  const total = lines.reduce((s, l) => s + (l.p ? l.p.price * Math.min(l.quantity, l.left) : 0), 0);
  const problems = lines.some((l) => !l.p || l.left < l.quantity);

  if (!lines.length) {
    return (
      <div className="center">
        <h1 style={{ fontSize: 30 }}>Tu carrito está vacío</h1>
        <p className="muted">Sumá prendas desde la tienda o armá un look con el asesor.</p>
        <div className="hero-actions"><Link className="btn" href={href('/productos')}>Ver prendas</Link><Link className="btn ghost" href={href('/que-me-pongo')}>¿Qué me pongo?</Link></div>
      </div>
    );
  }

  return (
    <div className="layout-2">
      <section className="panel">
        <h1 style={{ fontSize: 28 }}>Tu carrito</h1>
        {lines.map((l) => (
          <div key={`${l.productId}-${l.sku}`} className="cart-row">
            <div style={{ width: 64, height: 80, borderRadius: 10, overflow: 'hidden' }}>{l.p ? <MediaView media={coverOf(l.p)} alt={l.p.name} category={l.p.category} /> : null}</div>
            <div style={{ minWidth: 0 }}>
              <b>{l.p?.name ?? 'Prenda no disponible'}</b>
              <div className="small muted">Talle {l.v?.size ?? '—'}{l.p ? ` · ${formatPesos(l.p.price)}` : ''}</div>
              {(!l.p || l.left <= 0) && <div className="warn">Ya no hay stock de este talle</div>}
              {l.p && l.left > 0 && l.left < l.quantity && <div className="warn">Solo quedan {l.left}</div>}
              <div className="qty" style={{ marginTop: 6 }}>
                <button onClick={() => setQuantity(l.productId, l.sku, l.quantity - 1)} aria-label="Menos">−</button>
                <span>{l.quantity}</span>
                <button onClick={() => setQuantity(l.productId, l.sku, l.quantity + 1)} disabled={l.quantity >= l.left} aria-label="Más">+</button>
              </div>
            </div>
            <button className="link small" onClick={() => setQuantity(l.productId, l.sku, 0)}>Quitar</button>
          </div>
        ))}
        <button className="link small" style={{ justifySelf: 'start' }} onClick={clearCart}>Vaciar carrito</button>
      </section>
      <aside className="panel">
        <div className="total-row"><span>Subtotal</span><span className="num">{formatPesos(total)}</span></div>
        <NetPrice price={total} label="Subtotal sin impuestos nacionales" />
        <ShippingCalculator subtotal={total} />
        <p className="small muted" style={{ margin: 0 }}>Pagás con Mercado Pago: tarjeta de crédito o débito, dinero en cuenta o efectivo.</p>
        {problems ? (
          <button
            className="btn block"
            onClick={() => lines.forEach((l) => setQuantity(l.productId, l.sku, l.p ? Math.min(l.quantity, l.left) : 0))}
          >
            Ajustar al stock disponible
          </button>
        ) : (
          <Link className="btn block" href={href('/checkout')}>Continuar compra</Link>
        )}
      </aside>
    </div>
  );
}
