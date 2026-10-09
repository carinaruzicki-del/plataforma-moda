import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../src/mp/signature';

const secret = 'clave-secreta';
const ts = '1791460000';
const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');

describe('firma de avisos de Mercado Pago', () => {
  const base = { secret, requestId: 'req-1', dataId: '123456', nowSeconds: Number(ts) + 10 };

  it('acepta una firma válida', () => {
    const v1 = sign(`id:123456;request-id:req-1;ts:${ts};`);
    expect(verifyWebhookSignature({ ...base, signatureHeader: `ts=${ts},v1=${v1}` })).toBe(true);
  });

  it('pasa a minúsculas los ids alfanuméricos', () => {
    const v1 = sign(`id:abc123;request-id:req-1;ts:${ts};`);
    expect(verifyWebhookSignature({ ...base, dataId: 'ABC123', signatureHeader: `ts=${ts},v1=${v1}` })).toBe(true);
  });

  it('rechaza firmas alteradas, viejas o ausentes', () => {
    const v1 = sign(`id:123456;request-id:req-1;ts:${ts};`);
    expect(verifyWebhookSignature({ ...base, dataId: '999', signatureHeader: `ts=${ts},v1=${v1}` })).toBe(false);
    expect(verifyWebhookSignature({ ...base, nowSeconds: Number(ts) + 3 * 86400, signatureHeader: `ts=${ts},v1=${v1}` })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signatureHeader: undefined })).toBe(false);
    expect(verifyWebhookSignature({ ...base, secret: '', signatureHeader: `ts=${ts},v1=${v1}` })).toBe(false);
  });
});
