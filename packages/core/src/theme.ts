/** Identidad visual aprobada. La tienda web y la app del comercio leen los colores de acá. */
export const colors = {
  paper: '#F7F4F0',
  surface: '#FFFFFF',
  ink: '#292625',
  muted: '#746E69',
  plum: '#754653',
  plumDark: '#633946',
  plumSoft: '#F2E8EB',
  sage: '#A8B2A0',
  sageSoft: '#E9F0E8',
  sageInk: '#586D55',
  line: '#E7E1DB',
  sand: '#EEE8E1',
  warnSoft: '#FBF0DF',
  warnInk: '#8A6234',
  danger: '#9B3B3B',
  dangerSoft: '#F8E6E4',
} as const;

export const fonts = {
  display: 'Fraunces',
  body: 'Manrope',
} as const;

export const radius = { card: 18, control: 12, pill: 999 } as const;

// ---------------------------------------------------------------- diseño de cada tienda

/** Nombre de la plataforma que se muestra en la leyenda del plan gratis. Provisorio. */
export const PLATFORM_NAME = '¿Qué me pongo?';

/** Paletas armadas por la plataforma. Todas pasan contraste AA con texto blanco. Disponibles en todos los planes. */
export const PALETTES = [
  { id: 'ciruela', name: 'Ciruela', accent: '#754653' },
  { id: 'bordo', name: 'Bordó', accent: '#7A2E3A' },
  { id: 'terracota', name: 'Terracota', accent: '#9A4A30' },
  { id: 'oliva', name: 'Oliva', accent: '#55613A' },
  { id: 'bosque', name: 'Bosque', accent: '#2F5D50' },
  { id: 'noche', name: 'Azul noche', accent: '#2F4A6B' },
  { id: 'lavanda', name: 'Lavanda', accent: '#5B4A7A' },
  { id: 'carbon', name: 'Carbón', accent: '#2B2826' },
] as const;
export type PaletteId = (typeof PALETTES)[number]['id'];

/** Tipografías para títulos. La de texto siempre es Manrope, por lectura. */
export const DISPLAY_FONTS = [
  { id: 'fraunces', name: 'Fraunces', family: 'Fraunces', css: 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600' },
  { id: 'playfair', name: 'Playfair Display', family: 'Playfair Display', css: 'Playfair+Display:wght@400;500;600' },
  { id: 'cormorant', name: 'Cormorant', family: 'Cormorant Garamond', css: 'Cormorant+Garamond:wght@500;600;700' },
  { id: 'dmserif', name: 'DM Serif', family: 'DM Serif Display', css: 'DM+Serif+Display' },
  { id: 'grotesk', name: 'Space Grotesk', family: 'Space Grotesk', css: 'Space+Grotesk:wght@400;500;600' },
  { id: 'manrope', name: 'Manrope', family: 'Manrope', css: 'Manrope:wght@500;600;700' },
] as const;
export type DisplayFontId = (typeof DISPLAY_FONTS)[number]['id'];

/** Diseños (estructura) de la tienda. 'clasico' está en todos los planes. */
export const LAYOUTS = [
  { id: 'clasico', name: 'Clásico', description: 'Portada grande y prendas en grilla, el de siempre.' },
  { id: 'editorial', name: 'Editorial', description: 'Tipo revista: logo centrado, fotos más grandes, más aire.' },
  { id: 'minimal', name: 'Minimal', description: 'Líneas rectas, sin sombras y más prendas por fila.' },
] as const;
export type LayoutId = (typeof LAYOUTS)[number]['id'];

export interface StoreTheme {
  palette?: PaletteId;
  /** Color exacto de la marca (planes con color libre). */
  accent?: string;
  font?: DisplayFontId;
  layout?: LayoutId;
}

/** Qué partes del diseño habilita cada plan. */
export interface DesignFeatures {
  freeColor: boolean;
  fontChoice: boolean;
  layouts: readonly LayoutId[];
  /** Muestra "Creada con …" en el pie. */
  branding: boolean;
}

export interface ResolvedTheme {
  accent: string;
  accentDark: string;
  accentSoft: string;
  accentLine: string;
  /** True si el color de la marca se oscureció para que el texto se lea. */
  adjusted: boolean;
  font: (typeof DISPLAY_FONTS)[number];
  layout: LayoutId;
  branding: boolean;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
/** Mezcla `a` con `b` (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function luminance(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Contraste WCAG entre dos colores (1 a 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Oscurece el color hasta que el texto blanco encima y el color como texto sobre el fondo
 * marfil se lean bien (AA, 4,5:1). Si ya cumple, lo deja igual.
 */
export function readableAccent(color: string): { color: string; adjusted: boolean } {
  let c = color.toUpperCase();
  for (let i = 0; i < 40 && (contrast(c, '#FFFFFF') < 4.5 || contrast(c, colors.paper) < 4.5); i++) c = mix(c, '#000000', 0.06);
  return { color: c, adjusted: c !== color.toUpperCase() };
}

/**
 * El diseño que se ve en la tienda. Lo que el plan no incluye se ignora (aunque esté guardado),
 * así una tienda que baja de plan vuelve sola a lo permitido.
 */
export function resolveTheme(theme: StoreTheme | undefined, features: DesignFeatures, legacyAccent?: string): ResolvedTheme {
  // Prioridad: color libre (si el plan lo incluye) → paleta elegida → color viejo si coincide con una paleta → ciruela.
  const custom = theme?.accent ?? legacyAccent;
  const palette =
    PALETTES.find((p) => p.id === theme?.palette) ?? PALETTES.find((p) => p.accent.toUpperCase() === legacyAccent?.toUpperCase());
  const base: string = features.freeColor && isHexColor(custom) ? custom : (palette?.accent ?? colors.plum);
  const { color, adjusted } = readableAccent(base);
  const font = (features.fontChoice && DISPLAY_FONTS.find((f) => f.id === theme?.font)) || DISPLAY_FONTS[0];
  const layout = theme?.layout && features.layouts.includes(theme.layout) ? theme.layout : 'clasico';
  return {
    accent: color,
    accentDark: mix(color, '#000000', 0.15),
    accentSoft: mix(color, '#FFFFFF', 0.88),
    accentLine: mix(color, '#FFFFFF', 0.65),
    adjusted,
    font,
    layout,
    branding: features.branding,
  };
}
