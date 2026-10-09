# Plataforma de tiendas de moda

Monorepo (npm workspaces). Idioma del producto y del código comentado: español rioplatense (voseo). Ver `README.md` y `docs/arquitectura.md`.

## Reglas que no se rompen

- Dinero, stock y estados de pedido se escriben **solo** en `functions/` y dentro de transacciones. Las apps nunca escriben `orders`, `products` ni campos de pago directo.
- Toda regla de negocio va en `packages/core` (puro, sin Firebase) con tests. `functions/src/orders/plan.ts` es la capa pura del servidor; mantenerla testeable.
- El asesor ¿Qué me pongo? solo recomienda prendas publicadas con stock disponible (`stock − reserved`) en el talle pedido. Nunca inventa.
- Cambios en `firestore.rules` o `storage.rules` van con su test en `rules-tests/`.
- Identidad visual: tokens en `packages/core/src/theme.ts` (ciruela #754653, marfil #F7F4F0, salvia #A8B2A0). Tipografías Fraunces + Manrope.

## Comandos

- `npm test` — tests de core y servidor.
- `npm run typecheck` — tipos de todos los paquetes.
- `npm run build:functions` — empaqueta el servidor con esbuild (incluye `@plataforma/core`).
- `npm test -w rules-tests` — reglas de seguridad (necesita Java y los emuladores).
- `npm run emulators` + `npm run seed` — entorno local con la tienda `demo`.

## Versiones

React 19.1.0 fijo en todo el repo (`overrides` en el package.json raíz) porque Expo SDK 54 lo exige; no subirlo sin subir Expo.
