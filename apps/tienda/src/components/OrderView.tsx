'use client';

import {
  canRequestWithdrawal,
  formatPesos,
  isCancellableByCustomer,
  STATUS_LABEL,
  withdrawalDeadline,
  type Order,
  type OrderStatus,
} from '@plataforma/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { callFn, errorMessage } from '@/lib/firebase';
import { useStore } from '@/lib/store-context';

type PublicOrder = Omit<Order, 'accessToken' | 'history'> & { history: Array<{ at: number; to: OrderStatus }> };

const STEPS_PICKUP: OrderStatus[] = ['pago_pendiente', 'pagado', 'en_preparacion', 'listo_para_retirar', 'entregado'];
const STEPS_SHIP: OrderStatus[] = ['pago_pendiente', 'pagado', 'en_preparacion', 'despachado', 'entregado'];
const fmtDate = (ms: number) => new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

export function OrderView({ orderId }: { orderId: string }) {
  const { store, href } = useStore();
  const params = useSearchParams();
  const token = params?.get('t') ?? '';
  const failed = params?.get('pago') === 'fallido';
  const paymentId = params?.get('payment_id') ?? params?.get('collection_id') ?? undefined;
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [state, setState] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'cancelar' | 'arrepentir' | null>(null);
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    if (!store) return;
    try {
      const r = await callFn<unknown, { order: PublicOrder }>('getMyOrder', {
        storeId: store.id,
        orderId,
        token,
        ...(paymentId && /^\d+$/.test(paymentId) ? { paymentId } : {}),
      });
      setOrder(r.order);
      setState('listo');
    } catch (e) {
      setError(errorMessage(e));
      setState('error');
    }
  }, [store, orderId, token, paymentId]);

  useEffect(() => {
    void load();
    // El pago puede tardar unos segundos en confirmarse: se actualiza solo mientras esté pendiente.
    const t = setInterval(() => {
      if (order?.status === 'pago_pendiente') void load();
    }, 8000);
    return () => clearInterval(t);
  }, [load, order?.status]);

  async function act(kind: 'cancelar' | 'arrepentir') {
    if (!store) return;
    setBusy(true);
    setError('');
    try {
      if (kind === 'cancelar') {
        await callFn('cancelMyOrder', { storeId: store.id, orderId, token });
      } else {
        const r = await callFn<unknown, { code: string }>('requestWithdrawal', { storeId: store.id, orderId, token });
        setCode(r.code);
      }
      setConfirm(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'cargando') return <div className="center muted">Buscando tu pedido…</div>;
  if (state === 'error' || !order) {
    return (
      <div className="center">
        <h1 style={{ fontSize: 28 }}>No encontramos ese pedido</h1>
        <p className="muted">{error || 'Abrí el link del email de compra o pedilo de nuevo.'}</p>
        <Link className="btn" href={href('/pedido')}>Buscar mi pedido</Link>
      </div>
    );
  }

  const steps = order.delivery.method === 'retiro' ? STEPS_PICKUP : STEPS_SHIP;
  const off = ['cancelado', 'devolucion', 'reembolsado'].includes(order.status);
  const idx = steps.indexOf(order.status);
  const when = (s: OrderStatus) => order.history.find((h) => h.to === s)?.at;
  const canCancel = isCancellableByCustomer(order.status);
  const canRegret = canRequestWithdrawal(order, Date.now());

  return (
    <div className="layout-2">
      <section className="panel">
        <span className="eyebrow">Pedido {order.number}</span>
        <h1 style={{ fontSize: 30 }}>{STATUS_LABEL[order.status]}</h1>
        {failed && order.status === 'pago_pendiente' && (
          <div className="note">El pago no se completó. Tus prendas siguen apartadas un rato: podés volver a intentarlo desde el carrito o escribirle al local.</div>
        )}
        {order.status === 'pago_pendiente' && !failed && <div className="note">Estamos esperando la confirmación de Mercado Pago. Esta página se actualiza sola.</div>}
        {code && <div className="note"><b>Tu código de trámite es {code}.</b> Te lo mandamos también por email. La tienda se va a contactar para coordinar la devolución.</div>}

        {off ? (
          <ul className="timeline">
            {order.history.map((h) => (
              <li key={`${h.to}-${h.at}`} className="done"><span className="dot" />{STATUS_LABEL[h.to]} <span className="small muted">· {fmtDate(h.at)}</span></li>
            ))}
          </ul>
        ) : (
          <ul className="timeline">
            {steps.map((s, i) => (
              <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
                <span className="dot" />
                {STATUS_LABEL[s]}
                {when(s) ? <span className="small muted">· {fmtDate(when(s)!)}</span> : null}
              </li>
            ))}
          </ul>
        )}

        {order.delivery.method === 'retiro' && store?.pickup && (
          <p className="small" style={{ margin: 0 }}>Retiro en <b>{store.pickup.address}</b> · {store.pickup.hours}</p>
        )}
        {order.delivery.trackingNumber && (
          <p className="small" style={{ margin: 0 }}>
            Seguimiento{order.delivery.carrier ? ` (${order.delivery.carrier})` : ''}: <b>{order.delivery.trackingNumber}</b>
            {order.delivery.trackingUrl && <> · <a className="link" href={order.delivery.trackingUrl} target="_blank" rel="noreferrer">ver envío</a></>}
          </p>
        )}

        {error && <p className="error-text" role="alert">{error}</p>}

        {canCancel && (confirm === 'cancelar' ? (
          <div className="note stack">
            <b>¿Cancelar el pedido {order.number}?</b>
            <span>{order.payment.paymentId ? 'Te devolvemos el total por Mercado Pago.' : 'Se liberan las prendas apartadas.'}</span>
            <div className="hero-actions"><button className="btn ghost" onClick={() => setConfirm(null)}>Volver</button><button className="btn danger" disabled={busy} onClick={() => act('cancelar')}>Cancelar pedido</button></div>
          </div>
        ) : (
          <button className="btn danger" style={{ justifySelf: 'start' }} onClick={() => setConfirm('cancelar')}>Cancelar pedido</button>
        ))}

        {canRegret && order.deliveredAt && (confirm === 'arrepentir' ? (
          <div className="note stack">
            <b>¿Te arrepentís de la compra?</b>
            <span>Te mandamos un código de trámite. La devolución no tiene costo y te reembolsamos el total cuando la tienda recibe la prenda.</span>
            <div className="hero-actions"><button className="btn ghost" onClick={() => setConfirm(null)}>Volver</button><button className="btn" disabled={busy} onClick={() => act('arrepentir')}>Confirmar arrepentimiento</button></div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            <button className="btn outline" style={{ justifySelf: 'start' }} onClick={() => setConfirm('arrepentir')}>Me arrepiento de la compra</button>
            <span className="small muted">Podés hacerlo hasta el {new Date(withdrawalDeadline(order.deliveredAt)).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}.</span>
          </div>
        ))}
      </section>

      <aside className="panel">
        <h2 style={{ fontSize: 20 }}>Detalle</h2>
        {order.items.map((i) => (
          <div key={i.sku} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{i.name} · {i.size} × {i.quantity}</span><span className="num">{formatPesos(i.unitPrice * i.quantity)}</span></div>
        ))}
        <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Envío</span><span className="num">{order.totals.shipping ? formatPesos(order.totals.shipping) : 'Gratis'}</span></div>
        <div className="total-row"><span>Total</span><span className="num">{formatPesos(order.totals.total)}</span></div>
        {order.payment.refundedAmount ? <span className="pill ok">Reembolsado {formatPesos(order.payment.refundedAmount)}</span> : null}
      </aside>
    </div>
  );
}
