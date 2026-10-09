import { Suspense } from 'react';
import { Stylist } from '@/components/Stylist';

export default function StylistPage() {
  return (
    <Suspense>
      <Stylist />
    </Suspense>
  );
}
