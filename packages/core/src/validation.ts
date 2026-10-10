import { z } from 'zod';
import { CATEGORIES, FITS, LINES, OCCASIONS, SECTION_KINDS, STYLES } from './catalog';
import { PROVINCES } from './shipping';
import type { DesignFeatures } from './theme';
import type { Plan, PlanId } from './types';

// ---------------------------------------------------------------- subdominios

/** Direcciones que no puede tomar ninguna tienda. */
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'panel', 'comercio', 'comercios', 'tienda', 'tiendas', 'ayuda',
  'soporte', 'blog', 'mail', 'email', 'static', 'cdn', 'assets', 'login', 'registro', 'cuenta',
  'pagos', 'checkout', 'status', 'dev', 'test', 'staging', 'plataforma',
]);

/** Convierte "Alma Indumentaria" en "alma-indumentaria". */
export function suggestSubdomain(storeName: string): string {
  return storeName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export const subdomainSchema = z
  .string()
  .min(3, 'Usá al menos 3 caracteres.')
  .max(40, 'Usá hasta 40 caracteres.')
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Solo minúsculas, números y guiones, sin guion al principio ni al final.')
  .refine((s) => !s.includes('--'), 'No uses dos guiones seguidos.')
  .refine((s) => !RESERVED_SUBDOMAINS.has(s), 'Esa dirección está reservada. Elegí otra.');

// ---------------------------------------------------------------- tienda

export const createStoreSchema = z.object({
  name: z.string().trim().min(2, 'Poné el nombre de la tienda.').max(60),
  subdomain: subdomainSchema,
  email: z.string().trim().email('Revisá el email.'),
  phone: z.string().trim().max(30).optional(),
});
export type CreateStoreInput = z.infer<typeof createStoreSchema>;

// ---------------------------------------------------------------- prendas

const mediaSchema = z.object({
  path: z.string().regex(/^stores\/[^/]+\/media\/[^/]+$/),
  type: z.enum(['image', 'video']),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const variantInputSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  size: z.string().trim().min(1, 'Poné el talle.').max(20),
  color: z.string().trim().max(30).optional(),
  stock: z.number().int().min(0).max(100000),
});

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Poné el nombre de la prenda.').max(80),
    description: z.string().trim().max(2000).default(''),
    brand: z.string().trim().max(40).optional(),
    category: z.enum(CATEGORIES),
    line: z.enum(LINES),
    color: z.string().trim().min(1, 'Poné el color.').max(30),
    fit: z.enum(FITS).nullable().optional(),
    styles: z.array(z.enum(STYLES)).max(STYLES.length).default([]),
    occasions: z.array(z.enum(OCCASIONS)).max(OCCASIONS.length).default([]),
    price: z.number().positive('Poné el precio.').max(100_000_000),
    compareAtPrice: z.number().positive().nullable().optional(),
    media: z.array(mediaSchema).max(12, 'Hasta 12 fotos o videos por prenda.').default([]),
    variants: z.array(variantInputSchema).min(1, 'Cargá al menos un talle.').max(60),
    sectionIds: z.array(z.string().min(1)).max(30).default([]),
    published: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    const sizes = new Set<string>();
    const skus = new Set<string>();
    for (const v of p.variants) {
      const key = `${v.size}|${v.color ?? ''}`;
      if (sizes.has(key)) ctx.addIssue({ code: 'custom', path: ['variants'], message: `El talle ${v.size} está repetido.` });
      if (skus.has(v.sku)) ctx.addIssue({ code: 'custom', path: ['variants'], message: `El código ${v.sku} está repetido.` });
      sizes.add(key);
      skus.add(v.sku);
    }
    if (p.published && !p.media.some((m) => m.type === 'image')) {
      ctx.addIssue({ code: 'custom', path: ['media'], message: 'Subí al menos una foto para publicar la prenda.' });
    }
    if (!['Calzado', 'Accesorio'].includes(p.category) && !p.fit) {
      ctx.addIssue({ code: 'custom', path: ['fit'], message: 'Elegí el calce.' });
    }
    if (p.compareAtPrice != null && p.compareAtPrice <= p.price) {
      ctx.addIssue({ code: 'custom', path: ['compareAtPrice'], message: 'El precio anterior tiene que ser mayor al actual.' });
    }
  });
export type ProductInput = z.infer<typeof productInputSchema>;

export const sectionInputSchema = z.object({
  name: z.string().trim().min(2).max(50),
  kind: z.enum(SECTION_KINDS),
  description: z.string().trim().max(200).optional(),
  cover: mediaSchema.nullable().optional(),
  order: z.number().int().min(0),
});

// ---------------------------------------------------------------- checkout

const addressSchema = z.object({
  street: z.string().trim().min(2).max(80),
  number: z.string().trim().min(1).max(10),
  floor: z.string().trim().max(20).optional(),
  city: z.string().trim().min(2).max(60),
  province: z.enum(PROVINCES, { errorMap: () => ({ message: 'Elegí la provincia.' }) }),
  postalCode: z.string().trim().regex(/^([A-Za-z]\d{4}[A-Za-z]{3}|\d{4})$/, 'Revisá el código postal.'),
  notes: z.string().trim().max(200).optional(),
});

export const checkoutInputSchema = z
  .object({
    storeId: z.string().min(1),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          sku: z.string().min(1),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1, 'El carrito está vacío.')
      .max(50),
    customer: z.object({
      name: z.string().trim().min(2, 'Poné tu nombre.').max(80),
      email: z.string().trim().email('Revisá el email.'),
      phone: z.string().trim().min(6, 'Poné un teléfono.').max(30),
    }),
    delivery: z.discriminatedUnion('method', [
      z.object({ method: z.literal('retiro') }),
      // La zona la calcula el servidor con la provincia y el código postal; zoneId es solo informativo.
      z.object({ method: z.literal('envio_propio'), zoneId: z.string().min(1).optional(), address: addressSchema }),
    ]),
    note: z.string().trim().max(400).optional(),
  });
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

// ---------------------------------------------------------------- planes

/**
 * Planes por defecto. Los valores reales se cargan en `platform/plans` y los define
 * la administración con un contador; estos sirven para desarrollo y emuladores.
 */
export const DEFAULT_PLANS: Record<PlanId, Plan> = {
  inicial: {
    id: 'inicial',
    name: 'Inicial',
    monthlyFee: 0,
    commissionPct: 3,
    features: {
      customDomain: false,
      carrierShipping: false,
      staffSeats: 0,
      design: { freeColor: false, fontChoice: false, layouts: ['clasico'], branding: true },
    },
  },
  esencial: {
    id: 'esencial',
    name: 'Esencial',
    monthlyFee: 19999,
    commissionPct: 1.5,
    features: {
      customDomain: true,
      carrierShipping: true,
      staffSeats: 2,
      design: { freeColor: true, fontChoice: false, layouts: ['clasico'], branding: false },
    },
  },
  profesional: {
    id: 'profesional',
    name: 'Profesional',
    monthlyFee: 49999,
    commissionPct: 0.8,
    features: {
      customDomain: true,
      carrierShipping: true,
      staffSeats: 10,
      design: { freeColor: true, fontChoice: true, layouts: ['clasico', 'editorial', 'minimal'], branding: false },
    },
  },
};

/** Funciones de diseño del plan. Si el documento del plan no las trae, se usan las de fábrica. */
export function designFeatures(planId: PlanId | string | undefined, plan?: Partial<Plan> | null): DesignFeatures {
  return plan?.features?.design ?? (DEFAULT_PLANS[planId as PlanId] ?? DEFAULT_PLANS.inicial).features.design;
}

/** Plan más barato que incluye una función de diseño (para mostrar "Disponible en …"). */
export function cheapestPlanWith(test: (d: DesignFeatures) => boolean): Plan | null {
  return Object.values(DEFAULT_PLANS).filter((p) => test(p.features.design)).sort((a, b) => a.monthlyFee - b.monthlyFee)[0] ?? null;
}

