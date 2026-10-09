'use client';

import type { Category, Media } from '@plataforma/core';
import { mediaUrl, placeholder } from '@/lib/media';

/** Foto o video de una prenda. Los videos se reproducen sin sonido y en bucle, como en redes. */
export function MediaView({ media, alt, category, controls }: { media: Media | null; alt: string; category?: Category; controls?: boolean }) {
  if (!media) return <img src={placeholder(category ?? 'Arriba')} alt={alt} />;
  if (media.type === 'video') {
    return <video src={mediaUrl(media.path)} muted playsInline loop autoPlay={!controls} controls={controls} preload="metadata" aria-label={alt} />;
  }
  return <img src={mediaUrl(media.path)} alt={alt} loading="lazy" />;
}
