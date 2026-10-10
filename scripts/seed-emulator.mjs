// Carga una tienda de prueba ("demo") en los emuladores locales de Firebase.
// Uso: con los emuladores corriendo (npm run emulators), en otra terminal: npm run seed
// Después: tienda en http://localhost:3000/t/demo · app del comercio con demo@tienda.test / demo1234
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'plataforma-moda-dev' });
const db = getFirestore();
const auth = getAuth();

const email = 'demo@tienda.test';
let uid;
try {
  uid = (await auth.getUserByEmail(email)).uid;
} catch {
  uid = (await auth.createUser({ email, password: 'demo1234', displayName: 'Dueña demo' })).uid;
}

const storeId = 'demo-store';
const now = Date.now();
await db.doc('subdomains/demo').set({ storeId, createdAt: now });
await db.doc(`stores/${storeId}`).set({
  name: 'Tienda Demo',
  subdomain: 'demo',
  customDomain: null,
  ownerUid: uid,
  // Para probar el plan gratis, cambiá a 'inicial' (o editalo en el Emulator UI).
  plan: process.env.SEED_PLAN || 'profesional',
  theme: { palette: 'ciruela', layout: 'clasico' },
  status: 'activa',
  logoPath: null,
  tagline: 'Tu estilo, tus planes',
  contact: { email },
  pickup: { enabled: true, address: 'Av. Corrientes 1234, CABA', hours: 'Lunes a sábados de 10 a 19' },
  flatShipping: {
    enabled: true,
    zones: [
      { id: 'caba', name: 'CABA', price: 5000, provinces: ['CABA'], eta: 'Llega en 24 a 48 h hábiles', freeFrom: 150000 },
      { id: 'bsas', name: 'Provincia de Buenos Aires', price: 7500, provinces: ['Buenos Aires'], eta: 'Llega en 2 a 4 días hábiles' },
      { id: 'resto', name: 'Resto del país', price: 11000, eta: 'Llega en 4 a 7 días hábiles' },
    ],
  },
  mpConnected: false,
  createdAt: now,
  updatedAt: now,
});
await db.doc(`stores/${storeId}/members/${uid}`).set({ uid, role: 'duena', email, addedAt: now });
await db.doc(`stores/${storeId}/settings/home`).set({
  banner: [],
  bannerLayout: 'carrusel',
  bannerAutoplay: true,
  bannerIntervalSec: 6,
  sizeGuide: [
    { size: 'S', equivalence: '1', bustCm: '84-88', waistCm: '66-70', hipCm: '90-94' },
    { size: 'M', equivalence: '2', bustCm: '89-93', waistCm: '71-75', hipCm: '95-99' },
    { size: 'L', equivalence: '3', bustCm: '94-98', waistCm: '76-80', hipCm: '100-104' },
  ],
});
await db.doc(`stores/${storeId}/sections/noche`).set({ name: 'Para la noche', kind: 'Colección', description: 'Cenas, eventos y salidas.', cover: null, order: 0 });
await db.doc(`stores/${storeId}/sections/hombre`).set({ name: 'Hombre', kind: 'Categoría', description: '', cover: null, order: 1 });

const v = (sku, size, stock) => ({ sku, size, stock, reserved: 0 });
const products = [
  ['blusa-alba', { name: 'Blusa Alba', category: 'Arriba', line: 'Mujer', color: 'Marfil', fit: 'Regular', styles: ['Elegante', 'Clásico'], occasions: ['Cena', 'Trabajo', 'Evento'], price: 42000, variants: [v('BA-S', 'S', 2), v('BA-M', 'M', 3), v('BA-L', 'L', 2)], sectionIds: ['noche'] }],
  ['pantalon-siena', { name: 'Pantalón Siena', category: 'Abajo', line: 'Mujer', color: 'Negro', fit: 'Regular', styles: ['Elegante', 'Clásico'], occasions: ['Cena', 'Trabajo'], price: 58000, variants: [v('PS-38', '38', 2), v('PS-40', '40', 2), v('PS-42', '42', 1)], sectionIds: ['noche'] }],
  ['vestido-eva', { name: 'Vestido Eva', category: 'Vestido', line: 'Mujer', color: 'Bordó', fit: 'Entallado', styles: ['Elegante'], occasions: ['Cena', 'Evento'], price: 76000, variants: [v('VE-S', 'S', 1), v('VE-M', 'M', 2)], sectionIds: ['noche'] }],
  ['cartera-mini', { name: 'Cartera Mini', category: 'Accesorio', line: 'Unisex', color: 'Ciruela', fit: null, styles: ['Elegante', 'Clásico'], occasions: ['Cena', 'Evento', 'Trabajo'], price: 49000, variants: [v('CM-U', 'Único', 2)], sectionIds: ['noche'] }],
  ['camisa-nilo', { name: 'Camisa Nilo', category: 'Arriba', line: 'Hombre', color: 'Celeste', fit: 'Regular', styles: ['Clásico', 'Elegante'], occasions: ['Trabajo', 'Cena', 'Casual'], price: 51000, variants: [v('CN-M', 'M', 2), v('CN-L', 'L', 2)], sectionIds: ['hombre'] }],
  ['chino-roble', { name: 'Chino Roble', category: 'Abajo', line: 'Hombre', color: 'Camel', fit: 'Regular', styles: ['Clásico', 'Elegante'], occasions: ['Trabajo', 'Cena', 'Casual'], price: 56000, variants: [v('CR-40', '40', 2), v('CR-42', '42', 3)], sectionIds: ['hombre'] }],
];
for (const [id, p] of products) {
  await db.doc(`stores/${storeId}/products/${id}`).set({ ...p, storeId, description: '', media: [], published: true, createdAt: now, updatedAt: now });
}
console.log(`Listo. Tienda: http://localhost:3000/t/demo · App del comercio: ${email} / demo1234`);
