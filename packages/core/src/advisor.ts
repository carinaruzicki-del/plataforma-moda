import {
  FITLESS_CATEGORIES,
  FITS,
  UPPER_SIZE_CATEGORIES,
  type Category,
  type Fit,
  type Line,
  type Occasion,
  type Style,
} from './catalog';
import { available } from './stock';
import type { Pesos, Product, Variant } from './types';

/**
 * Asesor "¿Qué me pongo?"
 *
 * Regla de oro: solo recomienda prendas publicadas de la tienda, con stock disponible en el
 * talle de la clienta. Nunca inventa productos, colores ni disponibilidad. Si no encuentra
 * una combinación, lo dice y explica qué cambiar.
 */

export interface AdvisorPrefs {
  line: Exclude<Line, 'Unisex'> | 'Todas';
  occasion: Occasion;
  style: Style;
  /** 'Cualquiera' = no filtra por calce. */
  fit: Fit | 'Cualquiera';
  /** Talles vacíos = cualquiera con stock. */
  sizes: { upper?: string; lower?: string; shoe?: string };
  budget: Pesos;
  /** Armar el look alrededor de esta prenda. */
  anchorProductId?: string | null;
}

export interface LookItem {
  product: Product;
  variant: Variant;
  /** 2 = calce exacto, 1 = parecido o no aplica. */
  fitScore: number;
  styleMatch: boolean;
}

export interface Look {
  line: Exclude<Line, 'Unisex'>;
  items: LookItem[];
  total: Pesos;
  score: number;
}

export type AdvisorResult =
  | { ok: true; looks: Look[] }
  | { ok: false; reason: 'sin_prendas_para_ocasion' | 'sin_stock' | 'sin_combinacion'; message: string };

const MAX_LOOKS = 3;
const MAX_PER_BASE_CATEGORY = 8;
const EXTRA_CATEGORIES: readonly Category[] = ['Abrigo', 'Calzado', 'Accesorio'];

function wantedSize(category: Category, sizes: AdvisorPrefs['sizes']): string | undefined {
  if (UPPER_SIZE_CATEGORIES.includes(category)) return sizes.upper || undefined;
  if (category === 'Abajo') return sizes.lower || undefined;
  if (category === 'Calzado') return sizes.shoe || undefined;
  return undefined;
}

/** Variante con stock en el talle pedido; sin talle pedido, la primera con stock. */
function pickVariant(p: Product, sizes: AdvisorPrefs['sizes']): Variant | null {
  const want = wantedSize(p.category, sizes);
  const free = p.variants.filter((v) => available(v) > 0);
  if (want) return free.find((v) => v.size === want) ?? null;
  return free[0] ?? null;
}

/** 2 = mismo calce, 1 = calce vecino o no aplica, −1 = descartar. */
function fitScore(p: Product, fit: AdvisorPrefs['fit']): number {
  if (FITLESS_CATEGORIES.includes(p.category) || fit === 'Cualquiera' || !p.fit) return 1;
  const d = Math.abs(FITS.indexOf(p.fit) - FITS.indexOf(fit));
  return d === 0 ? 2 : d === 1 ? 1 : -1;
}

function styleMatches(p: Product, style: Style): boolean {
  return p.styles.length === 0 || p.styles.includes(style);
}

export function recommendLooks(products: readonly Product[], prefs: AdvisorPrefs): AdvisorResult {
  const lines: Exclude<Line, 'Unisex'>[] = prefs.line === 'Todas' ? ['Mujer', 'Hombre'] : [prefs.line];
  const looks: Look[] = [];

  for (const line of lines) {
    const pool: LookItem[] = [];
    for (const p of products) {
      if (!p.published || !(p.price > 0)) continue;
      if (p.line !== line && p.line !== 'Unisex') continue;
      if (!p.occasions.includes(prefs.occasion)) continue;
      const variant = pickVariant(p, prefs.sizes);
      if (!variant) continue;
      const fs = fitScore(p, prefs.fit);
      if (fs < 0) continue;
      pool.push({ product: p, variant, fitScore: fs, styleMatch: styleMatches(p, prefs.style) });
    }

    const base = (c: Category) =>
      pool
        .filter((x) => x.product.category === c && x.styleMatch)
        .sort((a, b) => b.fitScore - a.fitScore || a.product.price - b.product.price)
        .slice(0, MAX_PER_BASE_CATEGORY);
    const extras = (c: Category) =>
      pool
        .filter((x) => x.product.category === c)
        .sort(
          (a, b) =>
            Number(b.styleMatch) - Number(a.styleMatch) ||
            b.fitScore - a.fitScore ||
            a.product.price - b.product.price,
        );

    const anchor = prefs.anchorProductId ? pool.find((x) => x.product.id === prefs.anchorProductId) : undefined;

    const bases: LookItem[][] = base('Vestido').map((d) => [d]);
    const tops = base('Arriba');
    const bottoms = base('Abajo');
    for (const t of tops) for (const b of bottoms) bases.push([t, b]);

    for (const b of bases) {
      const items = [...b];
      let total = items.reduce((s, x) => s + x.product.price, 0);
      if (total > prefs.budget) continue;
      for (const c of EXTRA_CATEGORIES) {
        const useAnchor = anchor && anchor.product.category === c && total + anchor.product.price <= prefs.budget;
        const extra = useAnchor ? anchor : extras(c).find((x) => total + x.product.price <= prefs.budget);
        if (extra) {
          items.push(extra);
          total += extra.product.price;
        }
      }
      if (prefs.anchorProductId && !items.some((x) => x.product.id === prefs.anchorProductId)) continue;
      const score =
        items.reduce((s, x) => s + x.fitScore + (x.styleMatch ? 2 : 0), 0) + items.length * 0.5;
      looks.push({ line, items, total, score });
    }
  }

  looks.sort((a, b) => b.score - a.score || a.total - b.total);

  // Variedad: una misma prenda base aparece como mucho en dos looks.
  const chosen: Look[] = [];
  const uses = new Map<string, number>();
  for (const look of looks) {
    const keys = look.items.slice(0, 2).map((x) => x.product.id);
    if (keys.some((k) => (uses.get(k) ?? 0) >= 2)) continue;
    chosen.push(look);
    keys.forEach((k) => uses.set(k, (uses.get(k) ?? 0) + 1));
    if (chosen.length >= MAX_LOOKS) break;
  }

  if (chosen.length) return { ok: true, looks: chosen };
  return explainEmpty(products, prefs);
}

function explainEmpty(products: readonly Product[], prefs: AdvisorPrefs): AdvisorResult {
  const lines: Line[] = prefs.line === 'Todas' ? ['Mujer', 'Hombre', 'Unisex'] : [prefs.line, 'Unisex'];
  const forOccasion = products.filter(
    (p) => p.published && lines.includes(p.line) && p.occasions.includes(prefs.occasion),
  );
  const occ = prefs.occasion.toLowerCase();
  const who = prefs.line === 'Todas' ? '' : prefs.line === 'Mujer' ? 'de mujer ' : 'de hombre ';
  if (!forOccasion.length) {
    return {
      ok: false,
      reason: 'sin_prendas_para_ocasion',
      message: `La tienda todavía no tiene prendas ${who}pensadas para ${occ}. Probá con otra ocasión.`,
    };
  }
  if (!forOccasion.some((p) => p.variants.some((v) => available(v) > 0))) {
    return {
      ok: false,
      reason: 'sin_stock',
      message: `Las prendas ${who}para ${occ} están sin stock en este momento.`,
    };
  }
  return {
    ok: false,
    reason: 'sin_combinacion',
    message: `Hay prendas para ${occ}, pero ninguna combinación completa coincide con tu talle, calce, estilo y presupuesto. Probá dejar el talle en "Cualquiera", subir el presupuesto o elegir otro estilo.`,
  };
}
