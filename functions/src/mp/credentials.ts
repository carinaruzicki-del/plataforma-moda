import { MP_CLIENT_ID, MP_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY } from '../config';
import { decrypt, encrypt } from '../crypto';
import { paths } from '../repo';
import { refreshTokens, type OAuthTokens } from './api';

/** Lo que guardamos en `stores/<id>/private/mp`. Solo lo leen y escriben las funciones del servidor. */
interface StoredCredentials {
  mpUserId: number;
  publicKey: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  /** Vencimiento del access token (ms). Mercado Pago lo da por 180 días. */
  expiresAt: number;
  liveMode: boolean;
  updatedAt: number;
}

const RENEW_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

export async function saveCredentials(storeId: string, t: OAuthTokens, now = Date.now()) {
  const key = TOKEN_ENCRYPTION_KEY.value();
  const data: StoredCredentials = {
    mpUserId: t.user_id,
    publicKey: t.public_key,
    accessTokenEnc: encrypt(t.access_token, key),
    refreshTokenEnc: encrypt(t.refresh_token, key),
    expiresAt: now + t.expires_in * 1000,
    liveMode: t.live_mode ?? true,
    updatedAt: now,
  };
  await paths.mpCredentials(storeId).set(data);
}

/** Token para cobrar en nombre del comercio. Lo renueva solo si está por vencer. */
export async function getSellerToken(storeId: string): Promise<string> {
  const ref = paths.mpCredentials(storeId);
  const snap = await ref.get();
  const c = snap.data() as StoredCredentials | undefined;
  if (!c) throw new Error(`La tienda ${storeId} no tiene Mercado Pago conectado.`);
  const key = TOKEN_ENCRYPTION_KEY.value();
  if (c.expiresAt - Date.now() > RENEW_BEFORE_MS) return decrypt(c.accessTokenEnc, key);

  const fresh = await refreshTokens({
    clientId: MP_CLIENT_ID.value(),
    clientSecret: MP_CLIENT_SECRET.value(),
    refreshToken: decrypt(c.refreshTokenEnc, key),
  });
  await saveCredentials(storeId, fresh);
  return fresh.access_token;
}

/** Secretos que necesita cualquier función que cobre, reembolse o consulte pagos. */
export const MP_SECRETS = [MP_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY];
