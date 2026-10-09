'use client';

import type { HomeSettings, Product, Section, Store } from '@plataforma/core';
import { available } from '@plataforma/core';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db } from './firebase';

export interface CartLine {
  productId: string;
  sku: string;
  quantity: number;
}

interface StoreState {
  status: 'cargando' | 'lista' | 'no_existe' | 'error';
  subdomain: string;
  store: Store | null;
  products: Product[];
  sections: Section[];
  home: HomeSettings;
  /** Prefijo de las rutas: '' en el subdominio, '/t/<subdominio>' en desarrollo. */
  base: string;
  href: (path: string) => string;
  cart: CartLine[];
  addToCart: (line: CartLine) => { ok: boolean; message: string };
  addManyToCart: (lines: CartLine[]) => { ok: boolean; message: string };
  setQuantity: (productId: string, sku: string, quantity: number) => void;
  clearCart: () => void;
  productById: (id: string) => Product | undefined;
}

const Ctx = createContext<StoreState | null>(null);

export function useStore(): StoreState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore fuera de StoreProvider');
  return v;
}

function readCart(storeId: string): CartLine[] {
  try {
    const raw = localStorage.getItem(`carrito:${storeId}`);
    const arr = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(arr) ? arr.filter((l) => l && l.productId && l.sku && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ subdomain, children }: { subdomain: string; children: ReactNode }) {
  const [status, setStatus] = useState<StoreState['status']>('cargando');
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [home, setHome] = useState<HomeSettings>({ banner: [], sizeGuide: [] });
  const [cart, setCart] = useState<CartLine[]>([]);
  // Copia sincrónica del carrito: permite varios cambios seguidos en el mismo clic sin pisarse.
  const cartRef = useRef<CartLine[]>([]);
  const [base, setBase] = useState('');

  useEffect(() => {
    setBase(window.location.pathname.startsWith(`/t/${subdomain}`) ? `/t/${subdomain}` : '');
  }, [subdomain]);

  // Todo en vivo: lo que el local carga aparece al instante.
  useEffect(() => {
    let unsubs: Array<() => void> = [];
    let cancelled = false;
    (async () => {
      try {
        const sub = await getDoc(doc(db, 'subdomains', subdomain));
        const storeId = sub.get('storeId') as string | undefined;
        if (cancelled) return;
        if (!storeId) return setStatus('no_existe');
        cartRef.current = readCart(storeId);
        setCart(cartRef.current);
        const onErr = () => setStatus('error');
        unsubs = [
          onSnapshot(doc(db, 'stores', storeId), (s) => {
            if (!s.exists()) return setStatus('no_existe');
            setStore({ ...(s.data() as Store), id: s.id });
            setStatus('lista');
          }, () => setStatus('no_existe')),
          onSnapshot(
            query(collection(db, 'stores', storeId, 'products'), where('published', '==', true)),
            (s) => setProducts(s.docs.map((d) => ({ ...(d.data() as Product), id: d.id }))),
            onErr,
          ),
          onSnapshot(query(collection(db, 'stores', storeId, 'sections'), orderBy('order')), (s) =>
            setSections(s.docs.map((d) => ({ ...(d.data() as Section), id: d.id }))),
          onErr),
          onSnapshot(doc(db, 'stores', storeId, 'settings', 'home'), (s) =>
            setHome((s.data() as HomeSettings | undefined) ?? { banner: [], sizeGuide: [] }),
          onErr),
        ];
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [subdomain]);

  const persist = useCallback(
    (next: CartLine[]) => {
      cartRef.current = next;
      setCart(next);
      if (store) {
        try {
          localStorage.setItem(`carrito:${store.id}`, JSON.stringify(next));
        } catch {
          /* modo privado: el carrito vive solo en memoria */
        }
      }
    },
    [store],
  );

  const productById = useCallback((id: string) => products.find((p) => p.id === id), [products]);

  /** Suma varias líneas de una vez (un look completo): o entran todas, o ninguna. */
  const addManyToCart = useCallback(
    (lines: CartLine[]) => {
      let next = [...cartRef.current];
      let lastMessage = '';
      for (const line of lines) {
        const p = productById(line.productId);
        const v = p?.variants.find((x) => x.sku === line.sku);
        if (!p || !v) return { ok: false, message: 'Una de las prendas ya no está disponible.' };
        const inCart = next.filter((l) => l.productId === line.productId && l.sku === line.sku).reduce((s, l) => s + l.quantity, 0);
        const free = available(v) - inCart;
        if (free < line.quantity) {
          return {
            ok: false,
            message: free > 0 ? `${p.name}: solo quedan ${free} del talle ${v.size}.` : `${p.name}: no quedan unidades del talle ${v.size}.`,
          };
        }
        const existing = next.find((l) => l.productId === line.productId && l.sku === line.sku);
        next = existing
          ? next.map((l) => (l === existing ? { ...l, quantity: l.quantity + line.quantity } : l))
          : [...next, line];
        lastMessage = `Sumaste ${p.name} · talle ${v.size}.`;
      }
      persist(next);
      return { ok: true, message: lines.length > 1 ? 'Sumaste el look completo al carrito.' : lastMessage };
    },
    [persist, productById],
  );

  const addToCart = useCallback((line: CartLine) => addManyToCart([line]), [addManyToCart]);

  const setQuantity = useCallback(
    (productId: string, sku: string, quantity: number) =>
      persist(
        cartRef.current
          .map((l) => (l.productId === productId && l.sku === sku ? { ...l, quantity } : l))
          .filter((l) => l.quantity > 0),
      ),
    [persist],
  );

  const value = useMemo<StoreState>(
    () => ({
      status,
      subdomain,
      store,
      products,
      sections,
      home,
      base,
      href: (path: string) => `${base}${path.startsWith('/') ? path : `/${path}`}` || '/',
      cart,
      addToCart,
      addManyToCart,
      setQuantity,
      clearCart: () => persist([]),
      productById,
    }),
    [status, subdomain, store, products, sections, home, base, cart, addToCart, addManyToCart, setQuantity, persist, productById],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
