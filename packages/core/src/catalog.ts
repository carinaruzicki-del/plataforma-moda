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
