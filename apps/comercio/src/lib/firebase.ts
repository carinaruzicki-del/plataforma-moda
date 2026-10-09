import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'plataforma-moda-dev',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'plataforma-moda-dev.appspot.com',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const firstLoad = getApps().length === 0;
export const app = firstLoad ? initializeApp(config) : getApp();

/** En el celular la sesión se guarda en el dispositivo para no pedir el login cada vez. */
function makeAuth() {
  if (!firstLoad) return FirebaseAuth.getAuth(app);
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(app);
  const rnPersistence = (FirebaseAuth as unknown as { getReactNativePersistence: (s: typeof AsyncStorage) => FirebaseAuth.Persistence })
    .getReactNativePersistence;
  return FirebaseAuth.initializeAuth(app, { persistence: rnPersistence(AsyncStorage) });
}

export const auth = makeAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'southamerica-east1');

if (firstLoad && process.env.EXPO_PUBLIC_USE_EMULATORS === '1') {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1';
  FirebaseAuth.connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  connectStorageEmulator(storage, host, 9199);
}

export async function callFn<I, O>(name: string, data: I): Promise<O> {
  const res = await httpsCallable<I, O>(functions, name)(data);
  return res.data;
}

export function errorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'El email o la contraseña no coinciden.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Iniciá sesión.',
    'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
    'auth/invalid-email': 'Revisá el email.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
    'auth/network-request-failed': 'Sin conexión. Revisá internet y probá de nuevo.',
  };
  if (map[code]) return map[code]!;
  const m = (e as { message?: string })?.message;
  return m && !/internal|^firebase/i.test(m) ? m : 'Algo salió mal. Probá de nuevo en unos minutos.';
}

export function mediaUrl(path: string): string {
  const emu = process.env.EXPO_PUBLIC_USE_EMULATORS === '1';
  const host = emu ? `http://${process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1'}:9199` : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${config.storageBucket}/o/${encodeURIComponent(path)}?alt=media`;
}

export function storeLink(subdomain: string): string {
  const d = process.env.EXPO_PUBLIC_PLATFORM_DOMAIN || 'localhost:3000';
  return d.startsWith('localhost') ? `http://${d}/t/${subdomain}` : `https://${subdomain}.${d}`;
}
