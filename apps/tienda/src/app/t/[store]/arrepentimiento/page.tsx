import { OrderLookup } from '@/components/OrderLookup';

/** Botón de arrepentimiento (Ley 24.240, art. 34, y Resolución 424/2020 de la Secretaría de Comercio Interior). */
export default function RegretPage() {
  return (
    <div style={{ maxWidth: 640, margin: '28px auto 0' }} className="stack">
      <span className="eyebrow">Botón de arrepentimiento</span>
      <h1 style={{ fontSize: 32 }}>Arrepentirte de una compra</h1>
      <div className="panel">
        <p style={{ margin: 0 }}>
          Tenés <b>10 días corridos</b> desde que recibiste tu pedido para arrepentirte de la compra, sin dar explicaciones y <b>sin costo</b>: el envío de vuelta lo paga la tienda.
        </p>
        <p style={{ margin: 0 }} className="muted">
          Entrá a tu pedido y tocá <b>“Me arrepiento de la compra”</b>. Te mandamos al instante un código de trámite. Cuando la tienda recibe la prenda, te devolvemos el total por Mercado Pago.
        </p>
      </div>
      <OrderLookup />
    </div>
  );
}
