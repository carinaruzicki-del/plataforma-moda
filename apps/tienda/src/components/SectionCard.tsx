'use client';

import type { Section } from '@plataforma/core';
import Link from 'next/link';
import { coverOf } from '@/lib/media';
import { useStore } from '@/lib/store-context';
import { MediaView } from './MediaView';

export function SectionCard({ s }: { s: Section }) {
  const { products, href } = useStore();
  const ps = products.filter((p) => p.sectionIds.includes(s.id));
  const first = ps.find((p) => coverOf(p)) ?? ps[0];
  return (
    <Link className="sec-card" href={href(`/seccion/${s.id}`)}>
      <MediaView media={s.cover ?? (first ? coverOf(first) : null)} alt={s.name} category={first?.category} />
      <span>
        <b>{s.name}</b>
        <small>{s.kind} · {ps.length} {ps.length === 1 ? 'prenda' : 'prendas'}</small>
      </span>
    </Link>
  );
}
