import { Suspense } from 'react';
import { AccountPage } from '@/components/AccountPage';

export default function CuentaPage() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  );
}
