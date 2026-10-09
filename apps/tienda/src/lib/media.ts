import type { Category, Media, Product } from '@plataforma/core';
import { bucket, useEmulators } from './firebase';

/** URL pública de un archivo de Cloud Storage. */
export function mediaUrl(path: string): string {
  const host = useEmulators ? 'http://127.0.0.1:9199' : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

export function coverOf(p: Product): Media | null {
  return p.media.find((m) => m.type === 'image') ?? p.media[0] ?? null;
}

const SHAPES: Record<Category, string> = {
  Arriba: '<path d="M105 82 L135 66 Q150 86 165 66 L195 82 L238 120 L214 152 L194 138 L194 272 L106 272 L106 138 L86 152 L62 120 Z"/>',
  Abajo: '<path d="M108 68 L192 68 L206 292 L160 292 L150 142 L140 292 L94 292 Z"/>',
  Vestido: '<path d="M128 62 L172 62 L166 112 L216 292 L84 292 L134 112 Z"/>',
  Abrigo: '<path d="M108 62 L138 56 L150 112 L162 56 L192 62 L234 100 L226 302 L74 302 L66 100 Z"/>',
  Calzado: '<path d="M66 226 Q68 184 98 180 L140 174 Q160 204 202 210 Q238 216 238 244 L238 258 L66 258 Z"/>',
  Accesorio: '<path d="M98 142 L202 142 L216 274 L84 274 Z"/>',
};

/** Ilustración de reemplazo para prendas sin foto (solo se ven en el panel o en ocultas). */
export function placeholder(category: Category): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 375"><rect width="300" height="375" fill="#EEE8E1"/><g fill="#CDBFB4">${SHAPES[category]}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
