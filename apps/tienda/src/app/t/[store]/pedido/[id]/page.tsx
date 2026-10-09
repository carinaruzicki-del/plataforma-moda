import { Suspense } from 'react';
import { OrderView } from '@/components/OrderView';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <OrderView orderId={id} />
    </Suspense>
  );
}
