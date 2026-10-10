import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collectionGroup, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-plataforma',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'stores/s1'), { name: 'Alma', status: 'activa', plan: 'inicial', mpConnected: true, ownerUid: 'duena' });
    await setDoc(doc(db, 'stores/s1/members/duena'), { uid: 'duena', role: 'duena' });
    await setDoc(doc(db, 'stores/s1/members/emple'), { uid: 'emple', role: 'empleada' });
    await setDoc(doc(db, 'stores/s1/private/mp'), { accessTokenEnc: 'x' });
    await setDoc(doc(db, 'stores/s1/products/pub'), { published: true, name: 'Blusa' });
    await setDoc(doc(db, 'stores/s1/products/oculta'), { published: false, name: 'Saco' });
    await setDoc(doc(db, 'stores/s1/orders/o1'), { customer: { uid: 'ana' }, status: 'pagado' });
  });
});

const as = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

describe('tiendas', () => {
  it('cualquiera ve una tienda activa', () => assertSucceeds(getDoc(doc(as(), 'stores/s1'))));

  it('la dueña edita la vitrina pero no el plan ni los pagos', async () => {
    await assertSucceeds(updateDoc(doc(as('duena'), 'stores/s1'), { name: 'Alma Indumentaria', updatedAt: 1 }));
    await assertFails(updateDoc(doc(as('duena'), 'stores/s1'), { plan: 'profesional' }));
    await assertFails(updateDoc(doc(as('duena'), 'stores/s1'), { mpConnected: false }));
  });

  it('la dueña elige el diseño, con valores válidos', async () => {
    await assertSucceeds(updateDoc(doc(as('duena'), 'stores/s1'), { theme: { palette: 'bosque', accent: '#1F3A5F', font: 'playfair', layout: 'minimal' } }));
    await assertFails(updateDoc(doc(as('duena'), 'stores/s1'), { theme: { accent: 'red' } }));
    await assertFails(updateDoc(doc(as('duena'), 'stores/s1'), { theme: { palette: 'bosque', css: 'body{}' } }));
  });

  it('la dueña carga sus datos fiscales con CUIT de 11 dígitos', async () => {
    const fiscal = { legalName: 'Alma SAS', cuit: '30712345678', address: 'San Martín 123, Santa Fe', taxStatus: 'responsable_inscripto' };
    await assertSucceeds(updateDoc(doc(as('duena'), 'stores/s1'), { fiscal }));
    await assertFails(updateDoc(doc(as('duena'), 'stores/s1'), { fiscal: { ...fiscal, cuit: '30-71234567-8' } }));
    await assertFails(updateDoc(doc(as('duena'), 'stores/s1'), { fiscal: { ...fiscal, taxStatus: 'otro' } }));
  });

  it('una empleada no edita la tienda', () => assertFails(updateDoc(doc(as('emple'), 'stores/s1'), { name: 'Otra' })));

  it('nadie lee las credenciales de Mercado Pago', async () => {
    await assertFails(getDoc(doc(as('duena'), 'stores/s1/private/mp')));
    await assertFails(getDoc(doc(as(), 'stores/s1/private/mp')));
  });
});

describe('equipo', () => {
  it('cada persona lista las tiendas donde trabaja, y no las ajenas', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(as('emple'), 'members'), where('uid', '==', 'emple'))));
    await assertFails(getDocs(query(collectionGroup(as('emple'), 'members'), where('uid', '==', 'duena'))));
  });

  it('la dueña suma empleadas, pero nadie se agrega como dueña', async () => {
    await assertSucceeds(setDoc(doc(as('duena'), 'stores/s1/members/nueva'), { uid: 'nueva', role: 'empleada' }));
    await assertFails(setDoc(doc(as('emple'), 'stores/s1/members/otra'), { uid: 'otra', role: 'empleada' }));
    await assertFails(setDoc(doc(as('intrusa'), 'stores/s1/members/intrusa'), { uid: 'intrusa', role: 'duena' }));
  });
});

describe('prendas', () => {
  it('las publicadas son públicas; las ocultas, solo para el local', async () => {
    await assertSucceeds(getDoc(doc(as(), 'stores/s1/products/pub')));
    await assertFails(getDoc(doc(as(), 'stores/s1/products/oculta')));
    await assertSucceeds(getDoc(doc(as('emple'), 'stores/s1/products/oculta')));
  });

  it('nadie escribe prendas directo (pasa por saveProduct)', () =>
    assertFails(setDoc(doc(as('duena'), 'stores/s1/products/nueva'), { published: true })));
});

describe('pedidos', () => {
  it('el local ve sus pedidos; otra clienta no', async () => {
    await assertSucceeds(getDoc(doc(as('emple'), 'stores/s1/orders/o1')));
    await assertFails(getDoc(doc(as('otra'), 'stores/s1/orders/o1')));
  });

  it('la clienta lista sus propios pedidos', () =>
    assertSucceeds(getDocs(query(collectionGroup(as('ana'), 'orders'), where('customer.uid', '==', 'ana')))));

  it('nadie cambia un pedido desde la app', async () => {
    await assertFails(updateDoc(doc(as('duena'), 'stores/s1/orders/o1'), { status: 'entregado' }));
    await assertFails(updateDoc(doc(as('ana'), 'stores/s1/orders/o1'), { status: 'cancelado' }));
  });
});

describe('secciones y portada', () => {
  it('el local las edita; una clienta no', async () => {
    await assertSucceeds(setDoc(doc(as('emple'), 'stores/s1/sections/n'), { name: 'Noche', order: 0, kind: 'Colección' }));
    await assertFails(setDoc(doc(as('ana'), 'stores/s1/sections/n'), { name: 'Noche', order: 0 }));
    await assertSucceeds(setDoc(doc(as('duena'), 'stores/s1/settings/home'), { banner: [], sizeGuide: [] }));
  });
});
