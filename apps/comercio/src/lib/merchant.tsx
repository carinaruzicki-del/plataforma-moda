import type { HomeSettings, MemberRole, Order, Product, Section, Store } from '@plataforma/core';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, collectionGroup, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, db } from './firebase';

interface Membership {
  storeId: string;
  role: MemberRole;
}

interface MerchantState {
  /** undefined = todavía no sabemos si hay sesión. */
  user: User | null | undefined;
  memberships: Membership[] | undefined;
  storeId: string | null;
  role: MemberRole | null;
  setStoreId: (id: string) => void;
  store: Store | null;
  products: Product[];
  sections: Section[];
  home: HomeSettings;
  orders: Order[];
}

const Ctx = createContext<MerchantState | null>(null);

export function useMerchant() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMerchant fuera de MerchantProvider');
  return v;
}

/** Todo en vivo: lo que cambia en la base (ventas, stock, pedidos) se ve al instante en la app. */
export function MerchantProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [memberships, setMemberships] = useState<Membership[] | undefined>(undefined);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [home, setHome] = useState<HomeSettings>({ banner: [], sizeGuide: [] });
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setMemberships(user === null ? [] : undefined);
      setStoreId(null);
      return;
    }
    setMemberships(undefined);
    return onSnapshot(
      query(collectionGroup(db, 'members'), where('uid', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ storeId: d.ref.parent.parent?.id ?? '', role: d.get('role') as MemberRole }))
          .filter((m) => m.storeId);
        setMemberships(list);
        setStoreId((cur) => (cur && list.some((m) => m.storeId === cur) ? cur : list[0]?.storeId ?? null));
      },
      () => setMemberships([]),
    );
  }, [user]);

  useEffect(() => {
    setStore(null);
    setProducts([]);
    setSections([]);
    setOrders([]);
    if (!storeId) return;
    const base = `stores/${storeId}`;
    const unsubs = [
      onSnapshot(doc(db, base), (s) => setStore(s.exists() ? ({ ...(s.data() as Store), id: s.id }) : null)),
      onSnapshot(query(collection(db, base, 'products'), orderBy('createdAt', 'desc')), (s) =>
        setProducts(s.docs.map((d) => ({ ...(d.data() as Product), id: d.id })))),
      onSnapshot(query(collection(db, base, 'sections'), orderBy('order')), (s) =>
        setSections(s.docs.map((d) => ({ ...(d.data() as Section), id: d.id })))),
      onSnapshot(doc(db, base, 'settings', 'home'), (s) =>
        setHome((s.data() as HomeSettings | undefined) ?? { banner: [], sizeGuide: [] })),
      onSnapshot(query(collection(db, base, 'orders'), orderBy('createdAt', 'desc'), limit(200)), (s) =>
        setOrders(s.docs.map((d) => ({ ...(d.data() as Order), id: d.id })))),
    ];
    return () => unsubs.forEach((u) => u());
  }, [storeId]);

  const value = useMemo<MerchantState>(
    () => ({
      user,
      memberships,
      storeId,
      role: memberships?.find((m) => m.storeId === storeId)?.role ?? null,
      setStoreId,
      store,
      products,
      sections,
      home,
      orders,
    }),
    [user, memberships, storeId, store, products, sections, home, orders],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
