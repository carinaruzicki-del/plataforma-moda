'use client';

import { CATEGORIES, CATEGORY_LABEL, available, sortSizes, totalAvailable, type Product } from '@plataforma/core';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store-context';
import { ProductCard } from './ProductCard';

const norm = (s: string | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const uniq = (a: Array<string | undefined>) =>
  [...new Set(a.filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y, 'es', { numeric: true }));

/** Catálogo con búsqueda y filtros. Con `sectionId`, muestra solo esa sección. */
export function Catalog({ sectionId }: { sectionId?: string }) {
  const { products, sections, href } = useStore();
  const section = sectionId ? sections.find((s) => s.id === sectionId) : undefined;
  const base = useMemo(() => (sectionId ? products.filter((p) => p.sectionIds.includes(sectionId)) : products), [products, sectionId]);
  const [f, setF] = useState({ q: '', line: '', cat: '', color: '', size: '', brand: '', sort: 'nuevo' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const list = useMemo(() => {
    const q = norm(f.q);
    let out: Product[] = base.filter((p) => {
      if (q && !norm([p.name, p.brand, p.color, p.description, CATEGORY_LABEL[p.category]].join(' ')).includes(q)) return false;
      if (f.line && p.line !== f.line && p.line !== 'Unisex') return false;
      if (f.cat && p.category !== f.cat) return false;
      if (f.color && p.color !== f.color) return false;
      if (f.brand && p.brand !== f.brand) return false;
      if (f.size && !p.variants.some((v) => v.size === f.size && available(v) > 0)) return false;
      return true;
    });
    out = [...out].sort((a, b) =>
      f.sort === 'menor' ? a.price - b.price : f.sort === 'mayor' ? b.price - a.price : b.createdAt - a.createdAt,
    );
    // Primero lo que se puede comprar.
    return out.sort((a, b) => Number(totalAvailable(b.variants) > 0) - Number(totalAvailable(a.variants) > 0));
  }, [base, f]);

  const brands = uniq(base.map((p) => p.brand));

  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">{section ? section.kind : 'Colección disponible'}</div>
          <h2>{section ? section.name : 'Prendas'}</h2>
          <p>{section?.description || `${base.length} ${base.length === 1 ? 'prenda' : 'prendas'}, con stock actualizado al momento.`}</p>
        </div>
        {section && <Link className="link" href={href('/productos')}>← Todas las prendas</Link>}
      </div>
      {!section && sections.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {sections.map((s) => <Link key={s.id} className="chip" href={href(`/seccion/${s.id}`)}>{s.name}</Link>)}
        </div>
      )}
      <div className="filters" role="search">
        <input type="search" placeholder="Buscar por nombre, marca o color" value={f.q} onChange={set('q')} aria-label="Buscar prendas" />
        <select value={f.line} onChange={set('line')} aria-label="Colección"><option value="">Mujer y hombre</option><option>Mujer</option><option>Hombre</option></select>
        <select value={f.cat} onChange={set('cat')} aria-label="Tipo de prenda">
          <option value="">Todo tipo</option>
          {CATEGORIES.filter((c) => base.some((p) => p.category === c)).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <select value={f.color} onChange={set('color')} aria-label="Color"><option value="">Todos los colores</option>{uniq(base.map((p) => p.color)).map((c) => <option key={c}>{c}</option>)}</select>
        <select value={f.size} onChange={set('size')} aria-label="Talle"><option value="">Todos los talles</option>{sortSizes(base.flatMap((p) => p.variants.map((v) => v.size))).map((s) => <option key={s}>{s}</option>)}</select>
        {brands.length > 0 && <select value={f.brand} onChange={set('brand')} aria-label="Marca"><option value="">Todas las marcas</option>{brands.map((b) => <option key={b}>{b}</option>)}</select>}
        <select value={f.sort} onChange={set('sort')} aria-label="Ordenar"><option value="nuevo">Novedades</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option></select>
      </div>
      {list.length ? (
        <div className="grid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : base.length ? (
        <div className="empty"><b>No hay prendas con esos filtros</b><span>Probá sacar algún filtro o buscar otra palabra.</span>
          <button className="btn ghost" onClick={() => setF({ q: '', line: '', cat: '', color: '', size: '', brand: '', sort: 'nuevo' })}>Limpiar filtros</button></div>
      ) : (
        <div className="empty"><b>Todavía no hay prendas acá</b><span>Cuando el local las cargue, aparecen al instante.</span></div>
      )}
    </>
  );
}
