'use client';

import { formatPesos, STATUS_LABEL, type Order, type OrderStatus } from '@plataforma/core';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from '@/lib/account';
import { callFn } from '@/lib/firebase';
import { mediaUrl } from '@/lib/media';
import { savedOrders } from '@/lib/my-orders';
import { useStore } from '@/lib/store-context';

type Row = Pick<Order, 'id' | 'number' | 'status' | 'items' | 'totals' | 'delivery' | 'createdAt'> & { token: string };

const TONE: Partial<Record<OrderStatus, string>> = {
  pago_pendiente: 'low',
  pagado: 'ok',
  en_preparacion: 'accent',
  despachado: 'accent',
  listo_para_retirar: 'accent',
  entregado: 'ok',
  cancelado: 'out',
};

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

/**
 * "Mis pedidos" como en cualquier tienda online: se ven directo, sin pedir links por email.
 * Junta los pedidos de la cuenta (en vivo) y los hechos desde este dispositivo sin cuenta.
 */
export function MyOrders() {
  const { store, href } = useStore();
  const { user, orders } = useAccount();
  const [deviceRows, setDeviceRows] = useState<Row[]>([]);
  const [loadingDevice, setLoadingDevice] = useState(true);

  const accountRows = useMemo<Row[]>(
    () => (store ? orders.filter((o) => o.storeId === store.id).map((o) => ({ ...o, token: o.accessToken })) : []),
    [orders, store],
  );

  useEffect(() => {
    if (!store) return;
    let alive = true;
    const saved = savedOrders(store.id).slice(0, 10);
    if (!saved.length) {
      setLoadingDevice(false);
      return;
    }
    Promise.allSettled(
      saved.map((s) =>
        callFn<unknown, { order: Omit<Row, 'token'> }>('getMyOrder', { storeId: store.id, orderId: s.orderId, token: s.token }).then(
          (r) => ({ ...r.order, id: s.orderId, token: s.token }) as Row,
        ),
      ),
    ).then((res) => {
      if (!alive) return;
      setDeviceRows(res.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
      setLoadingDevice(false);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const rows = useMemo(() => {
    const seen = new Set(accountRows.map((r) => r.id));
    return [...accountRows, ...deviceRows.filter((r) => !seen.has(r.id))].sort((a, b) => b.createdAt - a.createdAt);
  }, [accountRows, deviceRows]);

  if (loadingDevice && !rows.length) return <div className="center muted">Buscando tus pedidos…</div>;

  if (!rows.length) {
    return (
      <div className="panel center" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 22 }}>Todavía no tenés pedidos acá</h2>
        <p className="muted" style={{ margin: 0 }}>
          {user ? 'Cuando compres en esta tienda, tus pedidos aparecen acá con su estado.' : 'Si compraste con cuenta, iniciá sesión para verlos.'}
        </p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          {!user && <Link className="btn" href={href('/cuenta?volver=pedido')}>Iniciar sesión</Link>}
          <Link className="btn ghost" href={href('/productos')}>Ver prendas</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {rows.map((o) => (
        <Link key={o.id} href={href(`/pedido/${o.id}?t=${encodeURIComponent(o.token)}`)} className="panel order-card">
          <div className="order-card-head">
            <span>
              <b>Pedido {o.number}</b> <span className="small muted">· {fmtDate(o.createdAt)}</span>
            </span>
            <span className={`pill ${TONE[o.status] ?? ''}`}>{STATUS_LABEL[o.status]}</span>
          </div>
          <div className="order-card-items">
            {o.items.slice(0, 4).map((i) => (
              <span key={i.sku} className="order-thumb">
                {i.imagePath ? <img src={mediaUrl(i.imagePath)} alt="" /> : <span aria-hidden>{i.name.charAt(0)}</span>}
              </span>
            ))}
            <span className="small muted" style={{ minWidth: 0 }}>
              {o.items.map((i) => `${i.name} (${i.size}${i.quantity > 1 ? ` ×${i.quantity}` : ''})`).join(', ')}
            </span>
          </div>
          <div className="order-card-foot small">
            <span className="muted">{o.delivery.method === 'retiro' ? 'Retiro en el local' : `Envío a ${o.delivery.address?.city ?? 'domicilio'}`}</span>
            <b className="num">{formatPesos(o.totals.total)}</b>
          </div>
        </Link>
      ))}
    </div>
  );
}
