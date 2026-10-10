'use client';

import type { BannerSlide } from '@plataforma/core';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { useStore } from '@/lib/store-context';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Piece({ s, active, onEnded }: { s: BannerSlide; active: boolean; onEnded?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active && !reduceMotion()) {
      v.currentTime = 0;
      v.play().catch(() => undefined);
    } else v.pause();
  }, [active]);
  if (s.media.type === 'video') {
    return <video ref={ref} src={mediaUrl(s.media.path)} muted playsInline preload="metadata" loop={!onEnded} onEnded={onEnded} aria-label={s.title || 'Video'} />;
  }
  return <img src={mediaUrl(s.media.path)} alt={s.title || ''} />;
}

function Copy({ s }: { s: BannerSlide | undefined }) {
  const { store, href } = useStore();
  return (
    <div className="banner-copy">
      <div className="eyebrow">{store?.tagline || 'Tu estilo, tus planes'}</div>
      <h1>{s?.title || 'Encontrá prendas que vayan con vos.'}</h1>
      <p>{s?.subtitle || 'Explorá la colección o contanos qué plan tenés: te armamos looks con prendas de esta tienda.'}</p>
      <div className="hero-actions">
        <Link className="btn" href={href('/que-me-pongo')}>Armar mi look →</Link>
        <Link className="btn ghost" href={s?.sectionId ? href(`/seccion/${s.sectionId}`) : href('/productos')}>Ver prendas</Link>
      </div>
    </div>
  );
}

/**
 * Banner de portada a todo el ancho. El local elige el formato en la app:
 * carrusel (pasa solo, fotos y videos), foto fija o mosaico de hasta 3 piezas.
 */
export function Banner() {
  const { home } = useStore();
  const slides = home.banner;
  const layout = home.bannerLayout ?? 'carrusel';
  const autoplay = home.bannerAutoplay ?? true;
  const interval = Math.max(3, home.bannerIntervalSec ?? 6) * 1000;
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const n = slides.length;
  const go = useCallback((i: number) => setCur(((i % n) + n) % n), [n]);
  const isCarousel = layout === 'carrusel' && n > 1;
  const current = slides[cur % Math.max(n, 1)];

  // Las fotos avanzan con el intervalo; los videos, cuando terminan.
  useEffect(() => {
    if (!isCarousel || !autoplay || paused || reduceMotion() || current?.media.type === 'video') return;
    const t = setTimeout(() => go(cur + 1), interval);
    return () => clearTimeout(t);
  }, [isCarousel, autoplay, paused, cur, interval, go, current?.media.type]);

  if (!n) {
    return (
      <section className="banner banner-empty" aria-label="Portada">
        <Copy s={undefined} />
      </section>
    );
  }

  if (layout === 'mosaico' && n > 1) {
    const pieces = slides.slice(0, 3);
    return (
      <section className={`banner banner-mosaic m${pieces.length}`} aria-label="Portada">
        {pieces.map((s, i) => (
          <div key={s.media.path} className={`tile${i === 0 ? ' main' : ''}`}>
            <Piece s={s} active />
            {i === 0 && <Copy s={s} />}
          </div>
        ))}
      </section>
    );
  }

  if (layout === 'fija' || n === 1) {
    return (
      <section className="banner" aria-label="Portada">
        <div className="slide on"><Piece s={slides[0]!} active /></div>
        <Copy s={slides[0]} />
      </section>
    );
  }

  return (
    <section
      className="banner"
      aria-label="Portada"
      aria-roledescription="carrusel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        if (start != null && end != null && Math.abs(end - start) > 40) go(cur + (end < start ? 1 : -1));
        touchX.current = null;
      }}
    >
      {slides.map((s, i) => (
        <div key={s.media.path} className={`slide${i === cur ? ' on' : ''}`} aria-hidden={i !== cur}>
          <Piece s={s} active={i === cur} onEnded={autoplay ? () => go(i + 1) : undefined} />
        </div>
      ))}
      <Copy s={current} />
      <button className="banner-arrow prev" aria-label="Anterior" onClick={() => go(cur - 1)}>‹</button>
      <button className="banner-arrow next" aria-label="Siguiente" onClick={() => go(cur + 1)}>›</button>
      <div className="dots">
        {slides.map((s, i) => (
          <button key={s.media.path} aria-label={`Ver ${i + 1} de ${n}`} className={i === cur ? 'on' : ''} onClick={() => go(i)} />
        ))}
      </div>
    </section>
  );
}
