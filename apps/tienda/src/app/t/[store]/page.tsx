'use client';

import { totalAvailable } from '@plataforma/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MediaView } from '@/components/MediaView';
import { ProductCard } from '@/components/ProductCard';
import { SectionCard } from '@/components/SectionCard';
import { coverOf } from '@/lib/media';
import { useStore } from '@/lib/store-context';

export default function StoreHome() {
  const { store, home, products, sections, href } = useStore();
  const slides = home.banner;
  const [cur, setCur] = useState(0);

  useEffect(() => {
    if (slides.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setCur((c) => (c + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!store) return null;
  const slide = slides[cur % Math.max(slides.length, 1)];
  const withProducts = sections.filter((s) => products.some((p) => p.sectionIds.includes(s.id)));
  const news = [...products].sort((a, b) => (totalAvailable(b.variants) > 0 ? 1 : 0) - (totalAvailable(a.variants) > 0 ? 1 : 0) || b.createdAt - a.createdAt).slice(0, 8);
  const pics = products.filter((p) => totalAvailable(p.variants) > 0 && coverOf(p)).slice(0, 3);

  return (
    <>
      <section className="hero" aria-label="Portada">
        {slides.map((s, i) => (
          <div key={s.media.path} className={`slide${i === cur ? ' on' : ''}`}>
            <MediaView media={s.media} alt={s.title || store.name} />
          </div>
        ))}
        <div className="hero-copy">
          <div className="eyebrow">{store.tagline || 'Tu estilo, tus planes'}</div>
          <h1>{slide?.title || 'Encontrá prendas que vayan con vos.'}</h1>
          <p>{slide?.subtitle || 'Explorá la colección o contanos qué plan tenés: te armamos looks con prendas de esta tienda.'}</p>
          <div className="hero-actions">
            <Link className="btn" href={href('/que-me-pongo')}>Armar mi look →</Link>
            <Link className="btn ghost" href={slide?.sectionId ? href(`/seccion/${slide.sectionId}`) : href('/productos')}>Ver prendas</Link>
          </div>
        </div>
        {slides.length > 1 && (
          <div className="dots">
            {slides.map((s, i) => (
              <button key={s.media.path} aria-label={`Ver imagen ${i + 1}`} className={i === cur ? 'on' : ''} onClick={() => setCur(i)} />
            ))}
          </div>
        )}
      </section>

      {withProducts.length > 0 && (
        <>
          <div className="section-head">
            <div><h2>Secciones</h2><p>Recorré la tienda como la organizó el local.</p></div>
          </div>
          <div className="sec-grid">{withProducts.slice(0, 6).map((s) => <SectionCard key={s.id} s={s} />)}</div>
        </>
      )}

      <div className="section-head">
        <div><h2>Novedades</h2><p>Lo último que cargó el local.</p></div>
        <Link className="link" href={href('/productos')}>Ver todo →</Link>
      </div>
      {news.length ? (
        <div className="grid">{news.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <div className="empty"><b>Todavía no hay prendas publicadas</b><span>Cuando el local cargue su colección, aparece acá al instante.</span></div>
      )}

      <section className="feature">
        <div>
          <div className="eyebrow">Asesor de looks</div>
          <h2>¿Tenés un plan y no sabés qué ponerte?</h2>
          <p>Elegí la ocasión, tu estilo y cómo te gusta que te quede la ropa. Armamos combinaciones solo con prendas de esta tienda que tienen stock en tu talle.</p>
          <Link className="btn" href={href('/que-me-pongo')}>Decime qué me pongo →</Link>
        </div>
        <div className="feature-imgs">{pics.map((p) => <div key={p.id}><MediaView media={coverOf(p)} alt={p.name} category={p.category} /></div>)}</div>
      </section>
    </>
  );
}
