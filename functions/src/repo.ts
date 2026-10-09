import type { Order, Plan, PlanId, Product, Store } from '@plataforma/core';
import { DEFAULT_PLANS } from '@plataforma/core';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { db } from './firebase';

/** Rutas de Firestore. Todo lo de una tienda cuelga de `stores/<storeId>`. */
export const paths = {
  store: (storeId: string) => db.doc(`stores/${storeId}`),
  member: (storeId: string, uid: string) => db.doc(`stores/${storeId}/members/${uid}`),
  mpCredentials: (storeId: string) => db.doc(`stores/${storeId}/private/mp`),
  oauthState: (state: string) => db.doc(`oauthStates/${state}`),
  product: (storeId: string, productId: string) => db.doc(`stores/${storeId}/products/${productId}`),
  orders: (storeId: string) => db.collection(`stores/${storeId}/orders`),
  order: (storeId: string, orderId: string) => db.doc(`stores/${storeId}/orders/${orderId}`),
  returns: (storeId: string) => db.collection(`stores/${storeId}/returns`),
  subdomain: (sub: string) => db.doc(`subdomains/${sub}`),
  plan: (planId: string) => db.doc(`plans/${planId}`),
  processedEvent: (id: string) => db.doc(`processedEvents/${id}`),
};

function withId<T>(id: string, data: FirebaseFirestore.DocumentData | undefined): T | null {
  return data ? ({ ...data, id } as T) : null;
}

export async function getStore(storeId: string, tx?: Transaction): Promise<Store | null> {
  const ref = paths.store(storeId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  return withId<Store>(snap.id, snap.data());
}

export async function getOrder(storeId: string, orderId: string, tx?: Transaction): Promise<Order | null> {
  const ref = paths.order(storeId, orderId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  return withId<Order>(snap.id, snap.data());
}

export async function getProducts(
  storeId: string,
  productIds: Iterable<string>,
  tx: Transaction,
): Promise<Map<string, Product>> {
  const ids = [...new Set(productIds)];
  if (!ids.length) return new Map();
  const refs = ids.map((id) => paths.product(storeId, id));
  const snaps = await tx.getAll(...refs);
  const out = new Map<string, Product>();
  for (const s of snaps) {
    const p = withId<Product>(s.id, s.data());
    if (p) out.set(s.id, p);
  }
  return out;
}

export async function getPlan(planId: PlanId): Promise<Plan> {
  const snap = await paths.plan(planId).get();
  return (snap.data() as Plan | undefined) ?? DEFAULT_PLANS[planId] ?? DEFAULT_PLANS.inicial;
}

export async function isMember(storeId: string, uid: string, roles?: Array<'duena' | 'empleada'>) {
  const snap = await paths.member(storeId, uid).get();
  if (!snap.exists) return false;
  return roles ? roles.includes(snap.get('role')) : true;
}

export function writeVariants(tx: Transaction, storeId: string, variantsByProduct: Map<string, Product['variants']>, now: number) {
  for (const [productId, variants] of variantsByProduct) {
    tx.update(paths.product(storeId, productId) as DocumentReference, { variants, updatedAt: now });
  }
}
