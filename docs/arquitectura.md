# Arquitectura

Resumen técnico de la etapa 1. El documento de producto completo (cobros, envíos, seguridad, etapas) está en el doc compartido.

## Principio

Las apps leen en vivo y escriben solo lo que no involucra plata ni stock. **Todo lo que mueve dinero, stock o el estado de un pedido pasa por el servidor**, que lo valida con las reglas de `packages/core` y lo escribe en una transacción.

| Dato | Quién escribe | Cómo |
| --- | --- | --- |
| Tienda (vitrina, contacto, entregas) | Dueña | Directo a Firestore, limitado por `firestore.rules` |
| Plan, estado, subdominio, Mercado Pago | Servidor | `createStore`, `mpOAuthCallback`, `mpDisconnect` |
| Prendas y stock | Dueña o empleada | `saveProduct` / `deleteProduct` (conserva las unidades apartadas) |
| Secciones, portada, guía de talles | Dueña o empleada | Directo a Firestore |
| Pedidos | Servidor | `createCheckout`, `mpWebhook`, `updateOrderStatus`, `cancelMyOrder`, `requestWithdrawal`, `expireReservations` |
| Credenciales de Mercado Pago | Servidor | Cifradas con AES-256-GCM en `stores/{id}/private/mp`; nadie las lee desde una app |

## Flujo de una compra

1. La clienta arma el carrito (se guarda en su navegador).
2. `createCheckout` recalcula precios con la base, **aparta el stock** (`reserved`) por 30 minutos, crea el pedido en `pago_pendiente` y una preferencia de Mercado Pago con la cuenta del comercio y `marketplace_fee` (comisión de la plataforma, solo sobre productos).
3. La clienta paga en Mercado Pago.
4. `mpWebhook` valida la firma, **vuelve a consultar el pago** con el token del comercio y, si está aprobado y el monto coincide, pasa el pedido a `pagado` y descuenta el stock apartado.
5. Cada 5 minutos, `expireReservations` revisa los pedidos vencidos: consulta a Mercado Pago por si el aviso se perdió; si hubo cupón de efectivo, extiende la reserva hasta su vencimiento (tope 3 días); si no hay pago, cancela y libera el stock.
6. Un pago que llega después de cancelado se reembolsa solo.

## Estados del pedido

La tabla de transiciones vive en `packages/core/src/orders.ts` (`canTransition`). El servidor rechaza cualquier cambio que no esté ahí.

```
pago_pendiente → pagado → en_preparacion → listo_para_retirar → entregado → devolucion → reembolsado
                                         ↘ despachado ─────────↗
pago_pendiente / pagado / en_preparacion / listo_para_retirar → cancelado → reembolsado (si estaba pagado)
```

- La clienta cancela hasta `en_preparacion` (antes del envío).
- Botón de arrepentimiento: desde `entregado`, hasta el fin del día 10 corrido en hora argentina (`withdrawalDeadline`). Genera un código `ARR-XXXXXXXX` y lo envía por email en el momento.

## Stock

Cada variante tiene `stock` (unidades en el local) y `reserved` (apartadas por pedidos sin pagar). Disponible = `stock − reserved`. Efectos por transición (`stockEffect`): `commit` al pagar, `release` al cancelar sin pago, `restock` al cancelar un pedido pagado o recibir una devolución.

El stock vive dentro del documento de la prenda (no en una subcolección) para que la tienda y el asesor lo lean en una sola consulta y la transacción del checkout toque un documento por prenda.

## Datos (Firestore)

```
subdomains/{sub}                         → { storeId }
plans/{planId}                           → abono y comisión vigentes
stores/{storeId}                         → tienda
stores/{storeId}/members/{uid}           → dueña o empleada
stores/{storeId}/private/mp              → credenciales cifradas (solo servidor)
stores/{storeId}/products/{productId}    → prenda con variantes y stock
stores/{storeId}/sections/{sectionId}
stores/{storeId}/settings/home           → banner y guía de talles
stores/{storeId}/orders/{orderId}        → pedido (solo servidor)
stores/{storeId}/returns/{returnId}      → arrepentimientos y devoluciones
users/{uid}                              → perfil de la clienta (etapa 4)
```

## Tiendas y dominios

`apps/tienda/src/middleware.ts` convierte `alma.<dominio>` en la ruta `/t/alma`. En desarrollo se entra directo a `http://localhost:3000/t/<subdominio>`. Producción necesita un certificado comodín (`*.<dominio>`) en el hosting. Los dominios propios de los comercios llegan en la etapa 3.
