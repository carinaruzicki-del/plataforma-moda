import type { ReactNode } from 'react';
import { StoreShell } from '@/components/StoreShell';

export default async function StoreLayout({ children, params }: { children: ReactNode; params: Promise<{ store: string }> }) {
  const { store } = await params;
  return <StoreShell subdomain={decodeURIComponent(store).toLowerCase()}>{children}</StoreShell>;
}
