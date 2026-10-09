# Plataforma de tiendas de moda

Plataforma tipo Tiendanube, solo para comercios de indumentaria. Cada local crea su tienda online, carga sus prendas, cobra con Mercado Pago y gestiona pedidos. Lo que la diferencia es el asesor **¿Qué me pongo?**: arma looks solo con prendas de la tienda que tienen stock en el talle de la clienta.

> Nombre de la plataforma: pendiente. "¿Qué me pongo?" es el nombre de la función del asesor.

Documento de producto y backend (v0.2): ver el doc compartido en Claude. Resumen técnico en [`docs/arquitectura.md`](docs/arquitectura.md).

## Qué hay en este repositorio

| Carpeta | Qué es | Tecnología |
| --- | --- | --- |
| `apps/tienda` | La tienda web que ven las clientas (una por comercio, en su subdominio) | Next.js 15 |
| `apps/comercio` | La app del comercio: prendas, pedidos, portada, secciones, cobros | Expo (iOS, Android y web) |
| `functions` | El servidor: checkout, Mercado Pago, stock, pedidos, avisos por email | Cloud Functions (Node 22) |
| `packages/core` | Tipos, reglas de pedidos y stock, y el asesor de looks, compartidos por todo | TypeScript |
| `firestore.rules`, `storage.rules` | Reglas de seguridad de la base y de los archivos | Firebase |
| `rules-tests` | Tests de las reglas de seguridad (necesitan los emuladores) | Vitest |
| `scripts/seed-emulator.mjs` | Carga una tienda de prueba en los emuladores | Node |

## Abrirlo en Visual Studio Code

1. Instalá [Node.js 22](https://nodejs.org), [Git](https://git-scm.com) y [Java 21](https://adoptium.net) (lo usan los emuladores de Firebase).
2. En VS Code: **Ver → Paleta de comandos → Git: Clonar** y pegá `https://github.com/carinaruzicki-del/plataforma-moda`.
3. Cuando VS Code sugiera instalar las extensiones recomendadas, aceptá.
4. Abrí una terminal (**Terminal → Nueva terminal**) y corré:

```bash
npm install
```

## Probarlo en tu compu (sin cuentas reales)

Todo corre contra los **emuladores de Firebase**, así no tocás datos reales.

```bash
# Terminal 1: compilar el servidor y levantar los emuladores
cp functions/.env.example functions/.env.local
cp functions/.secret.example functions/.secret.local
npm run build:functions
npm run emulators

# Terminal 2: cargar la tienda de prueba
npm run seed

# Terminal 3: la tienda web → http://localhost:3000/t/demo
cp apps/tienda/.env.example apps/tienda/.env.local
npm run dev:tienda

# Terminal 4: la app del comercio (tocá "w" para abrirla en el navegador)
cp apps/comercio/.env.example apps/comercio/.env
npm run dev:comercio
```

En la app del comercio entrá con `demo@tienda.test` / `demo1234`. Lo que cargues o cambies ahí se ve al instante en la tienda.

Para probar desde el celular con Expo Go, poné la IP de tu compu en `EXPO_PUBLIC_EMULATOR_HOST` (en `apps/comercio/.env`).

El pago con Mercado Pago necesita credenciales de prueba (ver más abajo). Sin ellas, todo funciona menos el botón **Pagar**.

## Tests

```bash
npm test                      # reglas de negocio y servidor (no necesita nada más)
npm run typecheck             # tipos de todo el proyecto
npm test -w rules-tests       # reglas de seguridad (levanta los emuladores solo)
```

## Configurar Firebase y Mercado Pago (para publicar)

1. **Firebase**: creá el proyecto en [console.firebase.google.com](https://console.firebase.google.com), pasalo al plan **Blaze** (pago por uso; las funciones del servidor lo requieren) y activá Authentication (email y Google), Firestore (región `southamerica-east1`) y Storage. Poné el ID del proyecto en `.firebaserc`.
2. **Mercado Pago**: en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers) creá una aplicación de tipo marketplace. Anotá el `Client ID` y el `Client secret`, configurá como URL de redirección `https://<región>-<proyecto>.cloudfunctions.net/mpOAuthCallback` y, en Webhooks, copiá la clave secreta.
3. **Secretos del servidor**:

```bash
npx firebase functions:secrets:set MP_CLIENT_SECRET
npx firebase functions:secrets:set MP_WEBHOOK_SECRET
npx firebase functions:secrets:set TOKEN_ENCRYPTION_KEY   # pegá el resultado de: openssl rand -base64 32
npx firebase functions:secrets:set EMAIL_API_KEY          # clave de Resend (emails)
```

4. **Parámetros**: en `functions/.env.<proyecto>` poné `MP_CLIENT_ID`, `FUNCTIONS_BASE_URL`, `PLATFORM_DOMAIN`, `MEDIA_BASE_URL`, `MERCHANT_APP_URL` y `EMAIL_FROM` (ver `functions/src/config.ts`).
5. **Publicar**: `npx firebase deploy --only firestore,storage,functions`. La tienda web se publica con Firebase App Hosting conectando este repositorio (carpeta `apps/tienda`).

## Etapas

- **Etapa 1 (este código)**: alta de comercios con subdominio, panel con prendas (fotos, videos, talles y stock), secciones, portada y guía de talles, tienda web, carrito, cobro con Mercado Pago marketplace, pedidos con estados, retiro en el local y envío con tarifa propia, cancelaciones con reembolso, botón de arrepentimiento, emails, asesor ¿Qué me pongo?.
- **Etapa 2**: correos integrados (cotización, etiquetas y seguimiento automático), cambios de talle, avisos push en la app del comercio.
- **Etapa 3**: planes pagos con suscripción, dominio propio, empleadas, panel de la plataforma.
- **Etapa 4**: asesor avanzado (combinación de colores, perfil de talles con cuenta, explicaciones con IA sobre prendas ya filtradas).
