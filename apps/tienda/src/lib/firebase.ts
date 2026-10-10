'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'plataforma-moda-dev',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'plataforma-moda-dev.appspot.com',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';

const app = getApps().length ? getApp() : initializeApp(config);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'southamerica-east1');

if (useEmulators && typeof window !== 'undefined' && !(globalThis as { __emu?: boolean }).__emu) {
  (globalThis as { __emu?: boolean }).__emu = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

/** Llama a una función del servidor y devuelve su resultado. */
export async function callFn<I, O>(name: string, data: I): Promise<O> {
  const res = await httpsCallable<I, O>(functions, name)(data);
  return res.data;
}

/** Mensaje legible de un error del servidor (ya viene en español). */
export function errorMessage(e: unknown): string {
  const m = (e as { message?: string })?.message;
  return m && !/internal/i.test(m) ? m : 'Algo salió mal. Probá de nuevo en unos minutos.';
}

export const bucket = config.storageBucket;
