/**
 * Cliente mínimo de la API de Mercado Pago (REST). Usamos fetch directo en vez del SDK
 * para tener control total de los encabezados de idempotencia y de los errores.
 *
 * Modelo marketplace (división 1:1): cada comercio autoriza a la plataforma por OAuth.
 * Los cobros se crean con el token del comercio y llevan `marketplace_fee`, que Mercado Pago
 * acredita a la cuenta de la plataforma. La plataforma nunca tiene la plata del comercio.
 *
 * Documentación: https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
 */

const API = 'https://api.mercadopago.com';
const AUTH = 'https://auth.mercadopago.com.ar/authorization';

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'MercadoPagoError';
  }
}

async function call<T>(
  path: string,
  init: { method?: string; token?: string; body?: unknown; idempotencyKey?: string; form?: boolean },
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.idempotencyKey) headers['X-Idempotency-Key'] = init.idempotencyKey;
  let body: string | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  const res = await fetch(`${API}${path}`, { method: init.method ?? 'GET', headers, body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg = (json as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    throw new MercadoPagoError(`Mercado Pago: ${msg}`, res.status, json);
  }
  return json as T;
}

// ---------------------------------------------------------------- OAuth del comercio

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  public_key: string;
  user_id: number;
  /** Segundos de validez del access_token. */
  expires_in: number;
  live_mode?: boolean;
}

export function authorizationUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL(AUTH);
  u.searchParams.set('client_id', opts.clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('platform_id', 'mp');
  u.searchParams.set('state', opts.state);
  u.searchParams.set('redirect_uri', opts.redirectUri);
  return u.toString();
}

export function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<OAuthTokens> {
  return call<OAuthTokens>('/oauth/token', {
    method: 'POST',
    body: {
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      grant_type: 'authorization_code',
      code: opts.code,
      redirect_uri: opts.redirectUri,
    },
  });
}

export function refreshTokens(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<OAuthTokens> {
  return call<OAuthTokens>('/oauth/token', {
    method: 'POST',
    body: {
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: opts.refreshToken,
    },
  });
}

// ---------------------------------------------------------------- cobros

export interface PreferenceBody {
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    currency_id: 'ARS';
    picture_url?: string;
    category_id?: string;
  }>;
  payer: { name: string; email: string; phone?: { number: string } };
  external_reference: string;
  /** Solo https; en desarrollo local se omite y los pagos se confirman con la consulta periódica. */
  notification_url?: string;
  back_urls: { success: string; pending: string; failure: string };
  auto_return: 'approved';
  marketplace_fee: number;
  statement_descriptor?: string;
  expires: boolean;
  expiration_date_to?: string;
  shipments?: { cost: number; mode: 'not_specified' };
  binary_mode?: boolean;
  metadata?: Record<string, string>;
}

export interface Preference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export function createPreference(sellerToken: string, body: PreferenceBody, idempotencyKey: string) {
  return call<Preference>('/checkout/preferences', {
    method: 'POST',
    token: sellerToken,
    body,
    idempotencyKey,
  });
}

export interface Payment {
  id: number;
  status:
    | 'pending'
    | 'approved'
    | 'authorized'
    | 'in_process'
    | 'in_mediation'
    | 'rejected'
    | 'cancelled'
    | 'refunded'
    | 'charged_back';
  status_detail?: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  date_approved: string | null;
  /** Vencimiento de un pago pendiente (por ejemplo, el cupón de efectivo). */
  date_of_expiration?: string | null;
  marketplace_fee?: number;
}

export function getPayment(sellerToken: string, paymentId: string) {
  return call<Payment>(`/v1/payments/${encodeURIComponent(paymentId)}`, { token: sellerToken });
}

export async function findPaymentsByReference(sellerToken: string, externalReference: string) {
  const q = new URLSearchParams({ external_reference: externalReference, sort: 'date_created', criteria: 'desc' });
  const res = await call<{ results: Payment[] }>(`/v1/payments/search?${q}`, { token: sellerToken });
  return res.results ?? [];
}

/** Reembolso total (sin `amount`) o parcial. La clave de idempotencia evita reembolsar dos veces. */
export function refundPayment(sellerToken: string, paymentId: string, idempotencyKey: string, amount?: number) {
  return call<{ id: number; amount: number; status: string }>(
    `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
    {
      method: 'POST',
      token: sellerToken,
      body: amount == null ? {} : { amount },
      idempotencyKey,
    },
  );
}
