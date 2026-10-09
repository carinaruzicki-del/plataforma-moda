import { OrderLookup } from '@/components/OrderLookup';

export default function FindOrderPage() {
  return (
    <div style={{ maxWidth: 640, margin: '28px auto 0' }} className="stack">
      <h1 style={{ fontSize: 32 }}>Mi pedido</h1>
      <OrderLookup />
    </div>
  );
}
