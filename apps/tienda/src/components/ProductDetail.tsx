'use client';

import { available, CATEGORY_LABEL, FIT_LABEL, formatPesos, priceWithoutTaxes, sortSizes } from '@plataforma/core';
import Link from 'next/link';
import { useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { useStore } from '@/lib/store-context';
import { MediaView } from './MediaView';
import { SizeGuide } from './SizeGuide';
import { useToast } from './Toast';

export function ProductDetail({ id }: { id: string }) {
  const { productById, cart, addToCart, href, home } = useStore();
  const toast = useToast();
  const p = productById(id);
  const [mi, setMi] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState(false);

  if (!p) {
    return (
      <div className="center">
        <h1 style={{ fontSize: 28 }}>Esta prenda ya no está disponible</h1>
        <Link className="btn" href={href('/productos')}>Ver otras prendas</Link>
      </div>
    );
  }

  const inCart = (sku: string) => cart.filter((l) => l.productId === p.id && l.sku === sku).reduce((s, l) => s + l.quantity, 0);
  const left = (sku: string) => {
    const v = p.variants.find((x) => x.sku === sku);
    return v ? available(v) - inCart(sku) : 0;
  };
  const chosen = p.variants.find((v) => v.sku === size && left(v.sku) > 0) ?? p.variants.find((v) => left(v.sku) > 0) ?? null;
  const maxQty = chosen ? left(chosen.sku) : 0;
  const media = p.media[Math.min(mi, Math.max(p.media.length - 1, 0))] ?? null;
  const facts = [p.line, CATEGORY_LABEL[p.category], p.fit ? `Calce ${FIT_LABEL[p.fit].toLowerCase()}` : null, p.color].filter(Boolean);

  return (
    <div className="detail">
      <div className="gallery">
        <div className="gallery-main"><MediaView media={media} alt={p.name} category={p.category} controls={media?.type === 'video'} /></div>
        {p.media.length > 1 && (
          <div className="thumbs">
            {p.media.map((m, i) => (
              <button key={m.path} className={i === mi ? 'on' : ''} onClick={() => setMi(i)} aria-label={`Ver ${m.type === 'video' ? 'video' : 'foto'} ${i + 1}`}>
                {m.type === 'video' ? <><video src={mediaUrl(m.path)} muted preload="metadata" /><span className="play">▶</span></> : <img src={mediaUrl(m.path)} alt="" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="info">
        <span className="eyebrow">{p.brand || CATEGORY_LABEL[p.category]}</span>
        <h1>{p.name}</h1>
        <div className="price" style={{ fontSize: 22 }}>
          {formatPesos(p.price)}
          {p.compareAtPrice ? <s>{formatPesos(p.compareAtPrice)}</s> : null}
        </div>
        <NetPrice price={p.price} />
        <div className="chips">{facts.map((f) => <span key={f} className="pill accent">{f}</span>)}</div>
        {p.description && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{p.description}</p>}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b className="small">Talle</b>
            {home.sizeGuide.length > 0 && <button className="link small" onClick={() => setGuide(true)}>Guía de talles</button>}
          </div>
          <div className="sizes" role="radiogroup" aria-label="Talle">
            {(() => { const order = sortSizes(p.variants.map((v) => v.size)); return [...p.variants].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size)); })().map((v) => {
              const l = left(v.sku);
              const sold = available(v) <= 0;
              return (
                <button
                  key={v.sku}
                  role="radio"
                  aria-checked={chosen?.sku === v.sku}
                  className={`size${chosen?.sku === v.sku ? ' on' : ''}`}
                  disabled={l <= 0}
                  onClick={() => { setSize(v.sku); setQty(1); }}
                >
                  {v.size}
                  <small>{sold ? 'agotado' : l <= 0 ? 'en tu carrito' : l <= 2 ? `quedan ${l}` : ' '}</small>
                </button>
              );
            })}
          </div>
        </div>

        {chosen ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Menos">−</button>
              <span>{Math.min(qty, maxQty)}</span>
              <button onClick={() => setQty(Math.min(maxQty, qty + 1))} disabled={qty >= maxQty} aria-label="Más">+</button>
            </div>
            <button
              className="btn"
              onClick={() => {
                const r = addToCart({ productId: p.id, sku: chosen.sku, quantity: Math.min(qty, maxQty) });
                toast(r.message);
                if (r.ok) setQty(1);
              }}
            >
              Sumar al carrito
            </button>
          </div>
        ) : (
          <div className="note">{p.variants.some((v) => available(v) > 0) ? 'Ya tenés en el carrito todas las unidades disponibles.' : 'Esta prenda está sin stock por ahora.'}</div>
        )}

        {p.occasions.length > 0 && (
          <Link className="btn ghost" href={href(`/que-me-pongo?con=${p.id}`)}>✦ Armar un look con esta prenda</Link>
        )}
      </div>
      {guide && <SizeGuide onClose={() => setGuide(false)} />}
    </div>
  );
}

/** Res. SIC 4/2025: el precio sin impuestos nacionales va en letra más chica que el final. */
export function NetPrice({ price, label = 'Precio sin impuestos nacionales' }: { price: number; label?: string }) {
  const { store } = useStore();
  const net = priceWithoutTaxes(price, store?.fiscal);
  if (net === null) return null;
  return <p className="net-price">{label}: <span className="num">{formatPesos(net)}</span></p>;
}
