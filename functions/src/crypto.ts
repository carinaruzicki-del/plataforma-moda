import { createCipheriv, createDecipheriv, randomBytes, randomInt } from 'node:crypto';

/**
 * Cifrado de las credenciales de Mercado Pago de cada comercio (AES-256-GCM).
 * La clave vive en Secret Manager (TOKEN_ENCRYPTION_KEY, 32 bytes en base64); la base de datos
 * solo guarda el texto cifrado, así un acceso a Firestore no alcanza para cobrar en nombre de nadie.
 */

function key(base64Key: string): Buffer {
  const k = Buffer.from(base64Key, 'base64');
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY tiene que tener 32 bytes en base64.');
  return k;
}

export function encrypt(plain: string, base64Key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(base64Key), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join('.');
}

export function decrypt(payload: string, base64Key: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Formato de credencial desconocido.');
  const decipher = createDecipheriv('aes-256-gcm', key(base64Key), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

/** Número aleatorio criptográfico en [0, 1), para los códigos legibles del núcleo. */
export function secureRandom(): number {
  return randomInt(0, 2 ** 31) / 2 ** 31;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}
