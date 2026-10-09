import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret, defineString } from 'firebase-functions/params';

/** San Pablo: la región de Google Cloud más cercana a Argentina. */
export const REGION = 'southamerica-east1';
setGlobalOptions({ region: REGION, maxInstances: 20 });

/** Dominio de la plataforma; cada tienda vive en `<subdominio>.<PLATFORM_DOMAIN>`. */
export const PLATFORM_DOMAIN = defineString('PLATFORM_DOMAIN', { default: 'localhost:3000' });
/** `https` en producción, `http` en desarrollo local. */
export const PUBLIC_SCHEME = defineString('PUBLIC_SCHEME', { default: 'https' });
/** URL pública de las funciones HTTP (para los avisos de Mercado Pago y el retorno de OAuth). */
export const FUNCTIONS_BASE_URL = defineString('FUNCTIONS_BASE_URL');
/** Base pública de Cloud Storage, `https://firebasestorage.googleapis.com/v0/b/<bucket>/o` (fotos en el checkout de Mercado Pago). */
export const MEDIA_BASE_URL = defineString('MEDIA_BASE_URL', { default: '' });
/** Dirección del panel del comercio (para volver después de conectar Mercado Pago). */
export const MERCHANT_APP_URL = defineString('MERCHANT_APP_URL', { default: 'http://localhost:8081' });

/** Aplicación de la plataforma en Mercado Pago Developers. */
export const MP_CLIENT_ID = defineString('MP_CLIENT_ID');
export const MP_CLIENT_SECRET = defineSecret('MP_CLIENT_SECRET');
/** Clave para validar la firma de los avisos (Tus integraciones → Webhooks). */
export const MP_WEBHOOK_SECRET = defineSecret('MP_WEBHOOK_SECRET');

/** 32 bytes en base64: `openssl rand -base64 32`. */
export const TOKEN_ENCRYPTION_KEY = defineSecret('TOKEN_ENCRYPTION_KEY');

/** Emails transaccionales (Resend). Vacío en desarrollo: los emails se escriben en el log. */
export const EMAIL_API_KEY = defineSecret('EMAIL_API_KEY');
export const EMAIL_FROM = defineString('EMAIL_FROM', { default: 'Tiendas <pedidos@example.com>' });

export function storeUrl(subdomain: string, customHost?: string | null): string {
  const scheme = PUBLIC_SCHEME.value();
  if (customHost) return `${scheme}://${customHost}`;
  const domain = PLATFORM_DOMAIN.value();
  // En desarrollo local no hay subdominios: la tienda va en la ruta, /t/<subdominio>.
  if (domain.startsWith('localhost')) return `${scheme}://${domain}/t/${subdomain}`;
  return `${scheme}://${subdomain}.${domain}`;
}
