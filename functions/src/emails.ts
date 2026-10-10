import {
  colors,
  designFeatures,
  resolveTheme,
  formatPesos,
  STATUS_LABEL,
  WITHDRAWAL_DAYS,
  withdrawalDeadline,
  type Order,
  type ReturnRequest,
  type Store,
} from '@plataforma/core';
import { logger } from 'firebase-functions';
import { EMAIL_API_KEY, EMAIL_FROM, storeUrl } from './config';

/**
 * Avisos por email. Salen con el nombre de la tienda y responden al email del comercio.
 * Proveedor: Resend (https://resend.com). Sin clave configurada (desarrollo), se escriben en el log.
 */

interface Mail {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  fromName: string;
}

async function send(mail: Mail) {
  let key = '';
  try {
    key = EMAIL_API_KEY.value();
  } catch {
    key = '';
  }
  const fromAddress = EMAIL_FROM.value().replace(/^.*<(.+)>$/, '$1');
  const from = `${mail.fromName.replace(/[<>"]/g, '')} <${fromAddress}>`;
  if (!key) {
    logger.info('Email (sin enviar: falta EMAIL_API_KEY)', { to: mail.to, subject: mail.subject });
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, reply_to: mail.replyTo }),
  });
  if (!res.ok) logger.error('No se pudo enviar el email', { status: res.status, body: await res.text(), to: mail.to });
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(store: Store, title: string, body: string, cta?: { label: string; url: string }) {
  const accent = resolveTheme(store.theme, designFeatures(store.plan), store.accentColor).accent;
  return `<!doctype html><html lang="es"><body style="margin:0;background:${colors.paper};font-family:Arial,Helvetica,sans-serif;color:${colors.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:${colors.surface};border:1px solid ${colors.line};border-radius:16px" cellpadding="0" cellspacing="0">
<tr><td style="padding:24px 24px 8px;font-family:Georgia,serif;font-size:20px;color:${accent}">${esc(store.name)}</td></tr>
<tr><td style="padding:8px 24px;font-family:Georgia,serif;font-size:24px;line-height:1.2">${esc(title)}</td></tr>
<tr><td style="padding:8px 24px 16px;font-size:15px;line-height:1.55">${body}</td></tr>
${cta ? `<tr><td style="padding:0 24px 24px"><a href="${esc(cta.url)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">${esc(cta.label)}</a></td></tr>` : ''}
<tr><td style="padding:16px 24px;border-top:1px solid ${colors.line};font-size:12px;color:${colors.muted}">¿Dudas? Respondé este email y le llega a ${esc(store.name)}.</td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(order: Order) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.name)} · talle ${esc(i.size)} × ${i.quantity}</td><td align="right" style="padding:6px 0">${formatPesos(i.unitPrice * i.quantity)}</td></tr>`,
    )
    .join('');
  const ship = order.totals.shipping
    ? `<tr><td style="padding:6px 0">Envío</td><td align="right">${formatPesos(order.totals.shipping)}</td></tr>`
    : '';
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${rows}${ship}<tr><td style="padding:10px 0;border-top:1px solid ${colors.line}"><b>Total</b></td><td align="right" style="border-top:1px solid ${colors.line}"><b>${formatPesos(order.totals.total)}</b></td></tr></table>`;
}

function orderLink(store: Store, order: Order) {
  return `${storeUrl(store.subdomain, store.customDomain?.verified ? store.customDomain.host : null)}/pedido/${order.id}?t=${encodeURIComponent(order.accessToken)}`;
}

/** Aviso a la clienta según el nuevo estado del pedido. */
export async function notifyCustomer(store: Store, order: Order) {
  const url = orderLink(store, order);
  const n = `Pedido ${order.number}`;
  let subject = '';
  let title = '';
  let body = '';
  switch (order.status) {
    case 'pagado':
      subject = `${n}: recibimos tu pago`;
      title = '¡Gracias por tu compra!';
      body = `Recibimos el pago de tu pedido <b>${order.number}</b>. Te avisamos cuando esté listo.<br><br>${itemsTable(order)}`;
      break;
    case 'listo_para_retirar':
      subject = `${n}: listo para retirar`;
      title = 'Tu pedido está listo';
      body = `Podés pasar a retirarlo por <b>${esc(store.pickup?.address ?? 'el local')}</b>.<br>Horario: ${esc(store.pickup?.hours ?? 'consultá con la tienda')}.<br>Llevá el número de pedido: <b>${order.number}</b>.`;
      break;
    case 'despachado': {
      const d = order.delivery;
      const track = d.trackingNumber
        ? `<br>Seguimiento${d.carrier ? ` (${esc(d.carrier)})` : ''}: <b>${esc(d.trackingNumber)}</b>${d.trackingUrl ? ` · <a href="${esc(d.trackingUrl)}">ver envío</a>` : ''}`
        : '';
      subject = `${n}: está en camino`;
      title = 'Tu pedido salió';
      body = `Despachamos tu pedido <b>${order.number}</b>.${track}`;
      break;
    }
    case 'entregado': {
      const until = order.deliveredAt
        ? new Date(withdrawalDeadline(order.deliveredAt)).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
        : '';
      subject = `${n}: entregado`;
      title = '¡Que lo disfrutes!';
      body = `Tu pedido fue entregado. Si cambiaste de opinión, tenés ${WITHDRAWAL_DAYS} días corridos${until ? ` (hasta el ${until})` : ''} para arrepentirte de la compra sin costo, desde el link de abajo.`;
      break;
    }
    case 'cancelado':
      subject = `${n}: cancelado`;
      title = 'Tu pedido se canceló';
      body = order.payment.paymentId
        ? `Cancelamos el pedido <b>${order.number}</b> y pedimos el reembolso de ${formatPesos(order.totals.total)} a Mercado Pago. Según el medio de pago, puede tardar unos días en verse.`
        : `El pedido <b>${order.number}</b> se canceló porque no se registró el pago a tiempo. Si querés, podés volver a comprarlo.`;
      break;
    case 'reembolsado':
      subject = `${n}: reembolso realizado`;
      title = 'Te devolvimos la plata';
      body = `Hicimos el reembolso de tu pedido <b>${order.number}</b> por Mercado Pago.`;
      break;
    default:
      return;
  }
  await send({ to: order.customer.email, subject, html: layout(store, title, body, { label: 'Ver mi pedido', url }), replyTo: store.contact.email, fromName: store.name });
}

/** Aviso al comercio de una venta nueva. */
export async function notifyStoreNewOrder(store: Store, order: Order) {
  const method = order.delivery.method === 'retiro' ? 'Retira en el local' : 'Envío a domicilio';
  await send({
    to: store.contact.email,
    subject: `Venta nueva: pedido ${order.number} · ${formatPesos(order.totals.total)}`,
    html: layout(
      store,
      'Tenés una venta nueva',
      `<b>${esc(order.customer.name)}</b> (${esc(order.customer.email)}, ${esc(order.customer.phone)}) pagó el pedido <b>${order.number}</b>.<br>${method}.<br><br>${itemsTable(order)}`,
    ),
    fromName: 'Tu tienda',
  });
}

/** Arrepentimiento: código de trámite a la clienta (obligatorio dentro de las 24 h) y aviso al comercio. */
export async function notifyWithdrawal(store: Store, order: Order, ret: ReturnRequest) {
  await send({
    to: order.customer.email,
    subject: `Arrepentimiento del pedido ${order.number}: código ${ret.code}`,
    html: layout(
      store,
      'Recibimos tu solicitud',
      `Registramos tu arrepentimiento de compra del pedido <b>${order.number}</b>.<br>Tu código de trámite es <b style="font-size:18px">${ret.code}</b>.<br><br>${esc(store.name)} se va a contactar para coordinar la devolución, que no tiene costo para vos. Cuando reciba la prenda, te reembolsamos el total por Mercado Pago.`,
      { label: 'Ver mi pedido', url: orderLink(store, order) },
    ),
    replyTo: store.contact.email,
    fromName: store.name,
  });
  await send({
    to: store.contact.email,
    subject: `Arrepentimiento: pedido ${order.number} (código ${ret.code})`,
    html: layout(
      store,
      'Una clienta se arrepintió de una compra',
      `${esc(order.customer.name)} (${esc(order.customer.email)}, ${esc(order.customer.phone)}) pidió el arrepentimiento del pedido <b>${order.number}</b>.<br>Ya le enviamos el código <b>${ret.code}</b>.<br><br>Coordiná la devolución; el envío lo paga el comercio. Cuando recibas la prenda, marcá el pedido como reembolsado desde el panel.`,
    ),
    fromName: 'Tu tienda',
  });
}

/** Reenvía el link del pedido (lo pide la clienta desde el botón de arrepentimiento). */
export async function sendOrderLinkEmail(store: Store, order: Order) {
  await send({
    to: order.customer.email,
    subject: `Tu pedido ${order.number} en ${store.name}`,
    html: layout(
      store,
      'Este es el link de tu pedido',
      `Desde este link podés ver el estado del pedido <b>${order.number}</b>, cancelarlo si todavía no salió o arrepentirte de la compra dentro de los ${WITHDRAWAL_DAYS} días corridos desde que lo recibiste.`,
      { label: 'Ver mi pedido', url: orderLink(store, order) },
    ),
    replyTo: store.contact.email,
    fromName: store.name,
  });
}

export function statusLabel(s: Order['status']) {
  return STATUS_LABEL[s];
}

export const EMAIL_SECRETS = [EMAIL_API_KEY];
