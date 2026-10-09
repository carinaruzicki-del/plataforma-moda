// Empaqueta el servidor en un solo archivo, incluyendo @plataforma/core, porque Cloud Functions
// instala solo las dependencias publicadas en npm y no ve los paquetes del monorepo.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions', 'zod'],
  logLevel: 'info',
});
