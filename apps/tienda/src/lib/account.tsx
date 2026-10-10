'use client';

import type { Address, CustomerProfile, Order } from '@plataforma/core';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { collectionGroup, doc, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, db } from './firebase';

/**
 * Cuenta de la clienta. Es opcional: se puede comprar sin cuenta. Con cuenta, "Mi cuenta"
 * muestra todos sus pedidos y el checkout se completa solo con sus datos guardados.
 * Una misma cuenta sirve para todas las tiendas de la plataforma.
 */
interface AccountState {
  user: User | null | undefined;
  profile: CustomerProfile | null;
  /** Pedidos de la clienta en todas las tiendas (cada página filtra los de su tienda). */
  orders: Order[];
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (patch: Partial<Pick<CustomerProfile, 'name' | 'phone' | 'addresses' | 'sizes'>>) => Promise<void>;
}

const Ctx = createContext<AccountState | null>(null);

export function useAccount() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount fuera de AccountProvider');
  return v;
}

export function accountErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'El email o la contraseña no coinciden.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Iniciá sesión.',
    'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
    'auth/invalid-email': 'Revisá el email.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
    'auth/network-request-failed': 'Sin conexión. Revisá internet y probá de nuevo.',
  };
  return map[code] ?? 'No pudimos iniciar sesión. Probá de nuevo.';
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setOrders([]);
      return;
    }
    const unsubs = [
      onSnapshot(doc(db, 'users', user.uid), (s) => setProfile(s.exists() ? (s.data() as CustomerProfile) : null), () => setProfile(null)),
      onSnapshot(
        query(collectionGroup(db, 'orders'), where('customer.uid', '==', user.uid), orderBy('createdAt', 'desc')),
        (s) => setOrders(s.docs.map((d) => ({ ...(d.data() as Order), id: d.id }))),
        (e) => console.error('[cuenta] No se pudieron leer los pedidos', e),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const value = useMemo<AccountState>(
    () => ({
      user,
      profile,
      orders,
      login: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      register: async (name, email, password) => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: name.trim(),
          addresses: [],
          sizes: {},
          createdAt: Date.now(),
        } satisfies CustomerProfile);
      },
      loginWithGoogle: async () => {
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
      logout: () => signOut(auth),
      saveProfile: async (patch) => {
        const u = auth.currentUser;
        if (!u) return;
        const base: CustomerProfile = profile ?? { uid: u.uid, name: u.displayName ?? '', addresses: [], sizes: {}, createdAt: Date.now() };
        await setDoc(doc(db, 'users', u.uid), { ...base, ...patch });
      },
    }),
    [user, profile, orders],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export type { Address };
