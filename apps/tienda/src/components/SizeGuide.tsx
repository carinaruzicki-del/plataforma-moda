'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store-context';

export function SizeGuide({ onClose }: { onClose: () => void }) {
  const { home } = useStore();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Guía de talles" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(36,26,29,.42)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 50 }}>
      <div className="panel" style={{ width: 'min(560px, 100%)', maxHeight: '90dvh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 24 }}>Guía de talles</h2>
          <button className="btn ghost sm" onClick={onClose}>Cerrar</button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Medidas del cuerpo en centímetros, según las referencias de este local. Si estás entre dos talles, elegí el más grande para un calce más holgado.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr>{['Talle', 'Equivale a', 'Busto / pecho', 'Cintura', 'Cadera'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>
              {home.sizeGuide.map((r) => (
                <tr key={r.size}>
                  <td style={{ padding: 8, borderBottom: '1px solid var(--line)' }}><b>{r.size}</b></td>
                  <td style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>{r.equivalence || '—'}</td>
                  <td className="num" style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>{r.bustCm || '—'}</td>
                  <td className="num" style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>{r.waistCm || '—'}</td>
                  <td className="num" style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>{r.hipCm || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
