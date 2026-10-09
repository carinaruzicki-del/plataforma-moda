import type { Category, Fit, Line, Occasion, SectionKind, Style } from './catalog';

/** Milisegundos desde 1970 (Date.now()). Se usa en vez de Timestamp para que el núcleo no dependa de Firebase. */
export type Millis = number;

/** Montos en pesos argentinos, con hasta 2 decimales. */
export type Pesos = number;

// ---------------------------------------------------------------- planes

export type PlanId = 'inicial' | 'pro' | 'plus';

export interface Plan {
  id: PlanId;
  name: string;
  /** Abono mensual en pesos. 0 = gratis. */
  monthlyFee: Pesos;
  /** Comisión de la plataforma sobre cada venta, en porcentaje (2.5 = 2,5 %). */
  commissionPct: number;
  features: {
    customDomain: boolean;
    carrierShipping: boolean;
    staffSeats: number;
  };
}

// ---------------------------------------------------------------- tiendas

export type StoreStatus = 'activa' | 'suspendida';

export interface Store {
  id: string;
  name: string;
  /** Parte de la dirección: `<subdomain>.<dominio de la plataforma>`. Única. */
  subdomain: string;
  customDomain?: { host: string; verified: boolean } | null;
  ownerUid: string;
  plan: PlanId;
  status: StoreStatus;
  logoPath?: string | null;
  /** Color principal de la tienda (hex). Por defecto, el ciruela de la plataforma. */
  accentColor?: string;
  tagline?: string;
  contact: {
    email: string;
    phone?: string;
    whatsapp?: string;
    instagram?: string;
  };
  pickup?: {
    enabled: boolean;
    address: string;
    hours: string;
  };
  /** Envío con tarifa propia por zona (etapa 1). */
  flatShipping?: {
    enabled: boolean;
    zones: Array<{ id: string; name: string; price: Pesos; postalCodePrefixes?: string[] }>;
  };
  /** True cuando la dueña conectó su cuenta de Mercado Pago. Las credenciales viven en `private/mp`. */
  mpConnected: boolean;
  createdAt: Millis;
  updatedAt: Millis;
}

export type MemberRole = 'duena' | 'empleada';

export interface StoreMember {
  uid: string;
  role: MemberRole;
  email: string;
  addedAt: Millis;
}

// ---------------------------------------------------------------- catálogo

export interface Media {
  /** Ruta en Cloud Storage: `stores/<storeId>/media/<archivo>`. */
  path: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
}

export interface Variant {
  /** Identificador único dentro de la tienda. */
  sku: string;
  size: string;
  /** Solo si la prenda viene en varios colores con talles distintos. */
  color?: string;
  /** Unidades físicas en el local. */
  stock: number;
  /** Unidades apartadas por pedidos esperando pago. Disponibles = stock − reserved. */
  reserved: number;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  brand?: string;
  category: Category;
  line: Line;
  color: string;
  /** Vacío en calzado y accesorios. */
  fit?: Fit | null;
  styles: Style[];
  occasions: Occasion[];
  price: Pesos;
  /** Precio anterior, para mostrar una rebaja. */
  compareAtPrice?: Pesos | null;
  media: Media[];
  variants: Variant[];
  sectionIds: string[];
  published: boolean;
  /** Peso y medidas del paquete, para cotizar envíos (etapa 2). */
  shipping?: { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number };
  createdAt: Millis;
  updatedAt: Millis;
}

export interface Section {
  id: string;
  name: string;
  kind: SectionKind;
  description?: string;
  cover?: Media | null;
  order: number;
}

export interface BannerSlide {
  media: Media;
  title?: string;
  subtitle?: string;
  /** Sección a la que lleva el botón del banner. */
  sectionId?: string | null;
}

export interface SizeGuideRow {
  size: string;
  equivalence?: string;
  bustCm?: string;
  waistCm?: string;
  hipCm?: string;
}

export interface HomeSettings {
  banner: BannerSlide[];
  sizeGuide: SizeGuideRow[];
}

// ---------------------------------------------------------------- pedidos

export const ORDER_STATUSES = [
  'pago_pendiente',
  'pagado',
  'en_preparacion',
  'listo_para_retirar',
  'despachado',
  'entregado',
  'cancelado',
  'devolucion',
  'reembolsado',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type DeliveryMethod = 'retiro' | 'envio_propio' | 'correo';

export interface Address {
  street: string;
  number: string;
  floor?: string;
  city: string;
  province: string;
  postalCode: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  size: string;
  color?: string;
  /** Precio unitario al momento de la compra. */
  unitPrice: Pesos;
  quantity: number;
  imagePath?: string | null;
}

export interface OrderTotals {
  subtotal: Pesos;
  shipping: Pesos;
  total: Pesos;
  /** Lo que cobra la plataforma por esta venta (sale del pago, vía Mercado Pago). */
  platformFee: Pesos;
  commissionPct: number;
}

export interface OrderEvent {
  at: Millis;
  from: OrderStatus | null;
  to: OrderStatus;
  by: 'clienta' | 'comercio' | 'sistema' | 'plataforma';
  note?: string;
}

export interface Order {
  id: string;
  storeId: string;
  /** Número corto y legible para la clienta: A1B2C3. */
  number: string;
  status: OrderStatus;
  items: OrderItem[];
  totals: OrderTotals;
  customer: {
    uid: string | null;
    name: string;
    email: string;
    phone: string;
  };
  delivery: {
    method: DeliveryMethod;
    address?: Address | null;
    zoneId?: string | null;
    carrier?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
  };
  payment: {
    provider: 'mercadopago';
    preferenceId?: string | null;
    paymentId?: string | null;
    status?: string | null;
    paidAt?: Millis | null;
    refundedAmount?: Pesos;
  };
  /** Hasta cuándo se mantiene el stock apartado si no llega el pago. */
  reservationExpiresAt: Millis | null;
  deliveredAt: Millis | null;
  /** Clave secreta para que una clienta sin cuenta vea su pedido desde el link del email. */
  accessToken: string;
  note?: string;
  history: OrderEvent[];
  createdAt: Millis;
  updatedAt: Millis;
}

// ---------------------------------------------------------------- arrepentimiento y devoluciones

export type ReturnKind = 'arrepentimiento' | 'cambio';
export type ReturnStatus = 'solicitada' | 'aceptada' | 'recibida' | 'reembolsada' | 'rechazada';

export interface ReturnRequest {
  id: string;
  storeId: string;
  orderId: string;
  kind: ReturnKind;
  /** Código de trámite que exige la Resolución 424/2020. */
  code: string;
  status: ReturnStatus;
  items: Array<{ sku: string; quantity: number; newSize?: string }>;
  reason?: string;
  createdAt: Millis;
  updatedAt: Millis;
}

// ---------------------------------------------------------------- clientas

export interface CustomerProfile {
  uid: string;
  name: string;
  phone?: string;
  addresses: Address[];
  /** Talles guardados para el asesor. */
  sizes: { upper?: string; lower?: string; shoe?: string };
  createdAt: Millis;
}
