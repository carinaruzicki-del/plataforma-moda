'use client';

import Link from 'next/link';
import { MyOrders } from '@/components/MyOrders';
import { OrderLookup } from '@/components/OrderLookup';
import { useAccount } from '@/lib/account';
import { useStore } from '@/lib/store-context';

export default function MyOrdersPage() {
  const { href } = useStore();
  const { user } = useAccount();
  return (
    <div style={{ maxWidth: 720, margin: '28px auto 0' }} className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 32 }}>Mis pedidos</h1>
        {user ? (
          <Link className="link small" href={href('/cuenta')}>Mi cuenta</Link>
        ) : (
          <Link className="link small" href={href('/cuenta?volver=pedido')}>Iniciar sesión</Link>
        )}
      </div>
      <MyOrders />
      <details className="panel">
        <summary className="small" style={{ cursor: 'pointer' }}>¿Compraste desde otro celu o compu sin cuenta?</summary>
        <OrderLookup />
      </details>
    </div>
  );
}
