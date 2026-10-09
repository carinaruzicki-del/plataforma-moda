'use client';

import {
  FIT_LABEL,
  FITS,
  OCCASIONS,
  STYLES,
  UPPER_SIZE_CATEGORIES,
  available,
  formatPesos,
  recommendLooks,
  type AdvisorPrefs,
  type Category,
} from '@plataforma/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { coverOf } from '@/lib/media';
import { useStore } from '@/lib/store-context';
import { MediaView } from './MediaView';
import { useToast } from './Toast';

const PREFS_KEY = 'asesor:preferencias';

export function Stylist() {
  const { products, href, productById, addManyToCart } = useStore();
  const toast = useToast();
  const params = useSearchParams();
  const anchorId = params?.get('con') ?? null;
  const anchor = anchorId ? productById(anchorId) : undefined;
  const results = useRef<HTMLDivElement>(null);

  const [prefs, setPrefs] = useState<AdvisorPrefs>({
    line: 'Mujer',
    occasion: 'Cena',
    style: 'Elegante',
    fit: 'Regular',
    sizes: {},
    budget: 200000,
    anchorProductId: null,
  });
  const [ran, setRan] = useState(false);

  // Talles y gustos recordados en este dispositivo.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') as Partial<AdvisorPrefs> | null;
      if (saved) setPrefs((p) => ({ ...p, ...saved, anchorProductId: null }));
    } catch { /* sin preferencias guardadas */ }
  }, []);
  useEffect(() => {
    try {
      const { anchorProductId: _a, ...rest } = prefs;
      localStorage.setItem(PREFS_KEY, JSON.stringify(rest));
    } catch { /* modo privado */ }
  }, [prefs]);

  useEffect(() => {
    if (!anchor) return;
    setPrefs((p) => ({
      ...p,
      anchorProductId: anchor.id,
      line: anchor.line === 'Unisex' ? p.line : anchor.line,
      occasion: anchor.occasions.includes(p.occasion) ? p.occasion : anchor.occasions[0] ?? p.occasion,
      style: anchor.styles.length && !anchor.styles.includes(p.style) ? anchor.styles[0]! : p.style,
    }));
    setRan(true);
  }, [anchor]);

  const sizesFor = (cats: readonly Category[]) =>
    [...new Set(products.filter((p) => cats.includes(p.category)).flatMap((p) => p.variants.filter((v) => available(v) > 0).map((v) => v.size)))]
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const upper = sizesFor(UPPER_SIZE_CATEGORIES);
  const lower = sizesFor(['Abajo']);
  const shoe = sizesFor(['Calzado']);
  const maxBudget = Math.max(300000, Math.ceil(Math.max(0, ...products.map((p) => p.price)) * 3 / 50000) * 50000);

  // Se recalcula solo cuando cambian las prendas o el stock: el asesor siempre mira la tienda en vivo.
  const result = useMemo(() => (ran ? recommendLooks(products, prefs) : null), [ran, products, prefs]);

  const chips = <K extends 'line' | 'occasion' | 'style' | 'fit'>(k: K, values: readonly string[], labels?: Record<string, string>) => (
    <div className="chips" role="radiogroup">
      {values.map((v) => (
        <button key={v} role="radio" aria-checked={prefs[k] === v} className={`chip${prefs[k] === v ? ' on' : ''}`} onClick={() => setPrefs({ ...prefs, [k]: v })}>
          {labels?.[v] ?? v}
        </button>
      ))}
    </div>
  );
  const sizeSelect = (k: 'upper' | 'lower' | 'shoe', label: string, list: string[]) =>
    list.length > 0 && (
      <div className="field">
        <label htmlFor={`talle-${k}`}>{label}</label>
        <select id={`talle-${k}`} value={prefs.sizes[k] ?? ''} onChange={(e) => setPrefs({ ...prefs, sizes: { ...prefs.sizes, [k]: e.target.value || undefined } })}>
          <option value="">Cualquiera</option>
          {list.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
    );

  function addLook(items: Array<{ productId: string; sku: string }>) {
    const r = addManyToCart(items.map((it) => ({ ...it, quantity: 1 })));
    toast(r.ok ? r.message : `${r.message} Buscá looks de nuevo.`);
  }

  return (
    <section className="stylist">
      <div className="stylist-intro">
        <div className="eyebrow">Asesor de looks</div>
        <h1>¿Qué plan tenés?</h1>
        <p>Combinamos solo prendas de esta tienda que tienen stock en tus talles. Si no hay una combinación que funcione, te lo decimos.</p>
        {anchor && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,.12)', borderRadius: 14, padding: 10 }}>
            <div style={{ width: 52, height: 64, borderRadius: 9, overflow: 'hidden', flex: 'none' }}><MediaView media={coverOf(anchor)} alt={anchor.name} category={anchor.category} /></div>
            <div><div className="small" style={{ color: '#f0e2e6' }}>Armando looks con</div><b>{anchor.name}</b></div>
          </div>
        )}
      </div>
      <div className="stylist-form">
        <div className="q"><h3>¿Qué colección querés ver?</h3>{chips('line', ['Mujer', 'Hombre', 'Todas'])}</div>
        <div className="q"><h3>¿Para qué ocasión?</h3>{chips('occasion', OCCASIONS)}</div>
        <div className="q"><h3>¿Qué estilo te gusta?</h3>{chips('style', STYLES)}</div>
        <div className="q"><h3>¿Cómo preferís que te quede?</h3>{chips('fit', [...FITS, 'Cualquiera'], { ...FIT_LABEL, Cualquiera: 'Me da igual' })}</div>
        <div className="two">
          {sizeSelect('upper', 'Talle de arriba', upper)}
          {sizeSelect('lower', 'Talle de pantalón', lower)}
          {sizeSelect('shoe', 'Talle de calzado', shoe)}
        </div>
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label htmlFor="presupuesto">Presupuesto para el look</label>
            <span className="small num">Hasta {formatPesos(prefs.budget)}</span>
          </div>
          <input id="presupuesto" type="range" min={30000} max={maxBudget} step={10000} value={Math.min(prefs.budget, maxBudget)} onChange={(e) => setPrefs({ ...prefs, budget: Number(e.target.value) })} />
        </div>
        <button className="btn block" onClick={() => { setRan(true); setTimeout(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>
          Buscar looks disponibles →
        </button>

        <div ref={results} style={{ display: 'grid', gap: 12 }}>
          {result && !result.ok && <div className="note">{result.message}</div>}
          {result?.ok && (
            <>
              <h3 style={{ fontSize: 20 }}>Looks para {prefs.occasion.toLowerCase()}</h3>
              {result.looks.map((look, i) => (
                <article key={look.items.map((x) => x.variant.sku).join('-')} className="look">
                  <div className="look-head">
                    <h3>{i === 0 ? 'Una opción para vos' : 'Otra combinación'}{prefs.line === 'Todas' && <> <span className="pill accent">{look.line}</span></>}</h3>
                    <span className="why">● Estilo {prefs.style.toLowerCase()} · con stock en tus talles</span>
                  </div>
                  <div className="look-items">
                    {look.items.map((x) => (
                      <Link key={x.product.id} className="look-item" href={href(`/producto/${x.product.id}`)}>
                        <div style={{ aspectRatio: '3 / 4', borderRadius: 12, overflow: 'hidden' }}><MediaView media={coverOf(x.product)} alt={x.product.name} category={x.product.category} /></div>
                        <b>{x.product.name}</b>
                        <small>{formatPesos(x.product.price)} · talle {x.variant.size}</small>
                      </Link>
                    ))}
                  </div>
                  <div className="look-head">
                    <b className="num">Total {formatPesos(look.total)}</b>
                    <button className="btn outline sm" onClick={() => addLook(look.items.map((x) => ({ productId: x.product.id, sku: x.variant.sku })))}>
                      Sumar el look al carrito
                    </button>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
