/**
 * Vocabulario del catálogo de indumentaria. Estos valores los usan el formulario de carga
 * del comercio, los filtros de la tienda y el asesor de looks, así que tienen que ser iguales
 * en todas las partes del sistema.
 */

export const CATEGORIES = ['Arriba', 'Abajo', 'Vestido', 'Abrigo', 'Calzado', 'Accesorio'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  Arriba: 'Prendas de arriba',
  Abajo: 'Pantalones y faldas',
  Vestido: 'Vestidos y monos',
  Abrigo: 'Abrigos',
  Calzado: 'Calzado',
  Accesorio: 'Accesorios',
};

export const LINES = ['Mujer', 'Hombre', 'Unisex'] as const;
export type Line = (typeof LINES)[number];

/** Ordenados de más ajustado a más suelto: el asesor usa la distancia entre posiciones. */
export const FITS = ['Entallado', 'Regular', 'Holgado', 'Oversize'] as const;
export type Fit = (typeof FITS)[number];

export const FIT_LABEL: Record<Fit, string> = {
  Entallado: 'Al cuerpo',
  Regular: 'Regular',
  Holgado: 'Holgado',
  Oversize: 'Oversize',
};

export const STYLES = ['Elegante', 'Clásico', 'Cómodo', 'Urbano', 'Deportivo'] as const;
export type Style = (typeof STYLES)[number];

export const OCCASIONS = ['Trabajo', 'Cena', 'Casual', 'Evento', 'Fin de semana'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const SECTION_KINDS = [
  'Colección',
  'Marca',
  'Color',
  'Categoría',
  'Temporada',
  'Promoción',
  'Otra',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Tipos de prenda que no tienen calce (el asesor no los filtra por calce). */
export const FITLESS_CATEGORIES: readonly Category[] = ['Calzado', 'Accesorio'];

/** Tipos de prenda que usan el talle "de arriba" de la clienta. */
export const UPPER_SIZE_CATEGORIES: readonly Category[] = ['Arriba', 'Vestido', 'Abrigo'];

// ---------------------------------------------------------------- talles

/**
 * Sistemas de talles que ofrece la plataforma. El comercio elige de estas listas (no escribe
 * a mano), así todas las tiendas usan los mismos valores y el asesor puede comparar talles.
 */
export const SIZE_SYSTEMS = {
  letras: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  pantalon: Array.from({ length: 31 }, (_, i) => String(24 + i)),
  calzado: Array.from({ length: 14 }, (_, i) => String(33 + i)),
  unico: ['Único'],
} as const;
export type SizeSystem = keyof typeof SIZE_SYSTEMS;

export const SIZE_SYSTEM_LABEL: Record<SizeSystem, string> = {
  letras: 'Letras (XS a XXL)',
  pantalon: 'Números de pantalón (24 a 54)',
  calzado: 'Calzado (33 a 46)',
  unico: 'Talle único',
};

/** Sistema que se propone primero según el tipo de prenda (el comercio lo puede cambiar). */
export const DEFAULT_SIZE_SYSTEM: Record<Category, SizeSystem> = {
  Arriba: 'letras',
  Abajo: 'pantalon',
  Vestido: 'letras',
  Abrigo: 'letras',
  Calzado: 'calzado',
  Accesorio: 'unico',
};

const SIZE_ORDER: string[] = [...SIZE_SYSTEMS.letras, ...SIZE_SYSTEMS.unico];

/** Ordena talles como se leen en una tienda: XS, S, M… y los números de menor a mayor. */
export function sortSizes(sizes: Iterable<string>): string[] {
  const rank = (s: string): [number, number, string] => {
    const i = SIZE_ORDER.indexOf(s);
    if (i >= 0) return [0, i, s];
    const n = Number(s.replace(',', '.'));
    if (Number.isFinite(n)) return [1, n, s];
    return [2, 0, s];
  };
  return [...new Set(sizes)].sort((a, b) => {
    const [ga, na, sa] = rank(a);
    const [gb, nb, sb] = rank(b);
    return ga - gb || na - nb || sa.localeCompare(sb, 'es');
  });
}
