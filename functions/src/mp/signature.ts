import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifica la firma `x-signature` de un aviso (webhook) de Mercado Pago.
 *
 * El encabezado llega como `ts=<segundos>,v1=<hmac hex>`. Se firma con HMAC-SHA256 y la clave
 * secreta de la aplicación el texto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, omitiendo
 * las partes que no vienen. `data.id` sale de la URL y, si es alfanumérico, va en minúsculas.
 *
 * Igual que la firma, el servidor SIEMPRE vuelve a consultar el pago a Mercado Pago con el
 * token del comercio antes de actuar: nunca confía en el contenido del aviso.
 */
export function verifyWebhookSignature(opts: {
  secret: string;
  signatureHeader: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  nowSeconds: number;
  /** Tolerancia para avisos viejos o reenviados. */
  maxAgeSeconds?: number;
}): boolean {
  const { secret, signatureHeader } = opts;
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, ...v] = kv.trim().split('=');
      return [k?.trim() ?? '', v.join('=').trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  // Mercado Pago a veces manda ts en milisegundos.
  const tsSeconds = tsNum > 1e11 ? Math.floor(tsNum / 1000) : tsNum;
  const maxAge = opts.maxAgeSeconds ?? 60 * 60 * 24;
  if (Math.abs(opts.nowSeconds - tsSeconds) > maxAge) return false;

  let manifest = '';
  if (opts.dataId) {
    const id = /^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
    manifest += `id:${id};`;
  }
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1.toLowerCase(), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
