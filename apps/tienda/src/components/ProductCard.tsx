'use client';

import { formatPesos, totalAvailable, type Product } from '@plataforma/core';
import Link from 'next/link';
import { coverOf } from '@/lib/media';
import { useStore } from '@/lib/store-context';
import { MediaView } from './MediaView';

export function stockPill(p: Product) {
  const n = totalAvailable(p.variants);
  if (n <= 0) return <span className="pill out">Sin stock</span>;
  if (n <= 2) return <span className="pill low">Últimas unidades</span>;
  return null;
}

export function ProductCard({ p }: { p: Product }) {
  const { href } = useStore();
  return (
    <Link className="card" href={href(`/producto/${p.id}`)}>
      <div className="card-img">
        <MediaView media={coverOf(p)} alt={p.name} category={p.category} />
        {stockPill(p)}
      </div>
      <div className="card-body">
        <h3>{p.name}</h3>
        <div className="card-meta">{[p.brand, p.color].filter(Boolean).join(' · ')}</div>
        <div className="price">
          {formatPesos(p.price)}
          {p.compareAtPrice ? <s>{formatPesos(p.compareAtPrice)}</s> : null}
        </div>
      </div>
    </Link>
  );
}
