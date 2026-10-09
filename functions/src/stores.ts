import { createStoreSchema, subdomainSchema, type Store, type StoreMember } from '@plataforma/core';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { parse, requireMember, requireUid, wrap } from './callable';
import { FUNCTIONS_BASE_URL, MERCHANT_APP_URL, MP_CLIENT_ID, MP_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY } from './config';
import { randomToken } from './crypto';
import { db } from './firebase';
import { authorizationUrl, exchangeCode } from './mp/api';
import { saveCredentials } from './mp/credentials';
import { UserError } from './orders/plan';
import { paths } from './repo';

/** ¿Está libre esta dirección? Para validar mientras la dueña escribe. */
export const checkSubdomain = onCall(
  wrap(async (req) => {
    const r = subdomainSchema.safeParse((req.data as { subdomain?: unknown })?.subdomain);
    if (!r.success) return { available: false, message: r.error.issues[0]?.message ?? 'Dirección inválida.' };
    const taken = (await paths.subdomain(r.data).get()).exists;
    return { available: !taken, message: taken ? 'Esa dirección ya está en uso.' : null };
  }),
);

/**
 * Alta de tienda. Reserva el subdominio y crea la tienda y a la dueña en una transacción,
 * así dos personas no se quedan con la misma dirección.
 */
export const createStore = onCall(
  wrap(async (req) => {
    const uid = requireUid(req);
    const input = parse(createStoreSchema, req.data);
    const storeRef = db.collection('stores').doc();
    const now = Date.now();

    await db.runTransaction(async (tx) => {
      const subRef = paths.subdomain(input.subdomain);
      if ((await tx.get(subRef)).exists) throw new UserError('Esa dirección ya está en uso. Elegí otra.');
      const store: Omit<Store, 'id'> = {
        name: input.name,
        subdomain: input.subdomain,
        customDomain: null,
        ownerUid: uid,
        plan: 'inicial',
        status: 'activa',
        logoPath: null,
        tagline: '',
        contact: { email: input.email, ...(input.phone ? { phone: input.phone } : {}) },
        pickup: { enabled: false, address: '', hours: '' },
        flatShipping: { enabled: false, zones: [] },
        mpConnected: false,
        createdAt: now,
        updatedAt: now,
      };
      const member: StoreMember = { uid, role: 'duena', email: req.auth?.token.email ?? input.email, addedAt: now };
      tx.create(subRef, { storeId: storeRef.id, createdAt: now });
      tx.create(storeRef, store);
      tx.create(paths.member(storeRef.id, uid), member);
      tx.set(storeRef.collection('settings').doc('home'), { banner: [], sizeGuide: [] });
    });

    return { storeId: storeRef.id, subdomain: input.subdomain };
  }),
);

/** Devuelve el link para que la dueña autorice a la plataforma a cobrar en su nombre. */
export const mpConnectStart = onCall(
  wrap(async (req) => {
    const storeId = String((req.data as { storeId?: unknown })?.storeId ?? '');
    const uid = await requireMember(req, storeId, ['duena']);
    const state = randomToken();
    await paths.oauthState(state).set({ storeId, uid, createdAt: Date.now(), expiresAt: Date.now() + 15 * 60_000 });
    return {
      url: authorizationUrl({
        clientId: MP_CLIENT_ID.value(),
        redirectUri: `${FUNCTIONS_BASE_URL.value()}/mpOAuthCallback`,
        state,
      }),
    };
  }),
);

/** Mercado Pago vuelve acá después de que la dueña autoriza. Guarda las credenciales cifradas. */
export const mpOAuthCallback = onRequest(
  { secrets: [MP_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY] },
  async (req, res) => {
    const back = (ok: boolean, msg: string) =>
      res.redirect(`${MERCHANT_APP_URL.value()}/configuracion/pagos?mp=${ok ? 'ok' : 'error'}&msg=${encodeURIComponent(msg)}`);
    try {
      const code = String(req.query.code ?? '');
      const state = String(req.query.state ?? '');
      if (!code || !state) return back(false, 'Mercado Pago no devolvió la autorización.');

      const stateRef = paths.oauthState(state);
      const st = (await stateRef.get()).data() as { storeId: string; uid: string; expiresAt: number } | undefined;
      await stateRef.delete();
      if (!st || st.expiresAt < Date.now()) return back(false, 'El link venció. Probá conectar de nuevo.');

      const tokens = await exchangeCode({
        clientId: MP_CLIENT_ID.value(),
        clientSecret: MP_CLIENT_SECRET.value(),
        code,
        redirectUri: `${FUNCTIONS_BASE_URL.value()}/mpOAuthCallback`,
      });
      await saveCredentials(st.storeId, tokens);
      await paths.store(st.storeId).update({ mpConnected: true, updatedAt: Date.now() });
      return back(true, 'Mercado Pago quedó conectado.');
    } catch (e) {
      logger.error('Falló la conexión con Mercado Pago', { error: String(e) });
      return back(false, 'No pudimos conectar Mercado Pago. Probá de nuevo.');
    }
  },
);

/** Desconectar Mercado Pago: borra las credenciales y la tienda deja de poder cobrar. */
export const mpDisconnect = onCall(
  wrap(async (req) => {
    const storeId = String((req.data as { storeId?: unknown })?.storeId ?? '');
    await requireMember(req, storeId, ['duena']);
    await paths.mpCredentials(storeId).delete();
    await paths.store(storeId).update({ mpConnected: false, updatedAt: Date.now() });
    return { ok: true };
  }),
);

