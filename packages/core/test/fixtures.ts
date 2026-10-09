import type { Product } from '../src';

let n = 0;
export function product(p: Partial<Product> & Pick<Product, 'name' | 'category'>): Product {
  n++;
  return {
    id: p.id ?? `p${n}`,
    storeId: 's1',
    description: '',
    line: 'Mujer',
    color: 'Negro',
    fit: 'Regular',
    styles: ['Elegante'],
    occasions: ['Cena'],
    price: 40000,
    media: [],
    variants: [{ sku: `p${n}-M`, size: 'M', stock: 2, reserved: 0 }],
    sectionIds: [],
    published: true,
    createdAt: 0,
    updatedAt: 0,
    ...p,
  };
}
