/** Pedidos hechos desde este dispositivo, para encontrarlos sin cuenta ni email. */
export interface SavedOrder {
  orderId: string;
  number: string;
  token: string;
  at: number;
}

export function savedOrders(storeId: string): SavedOrder[] {
  try {
    const v = JSON.parse(localStorage.getItem(`pedidos:${storeId}`) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveOrder(storeId: string, o: SavedOrder) {
  try {
    const list = [o, ...savedOrders(storeId).filter((x) => x.orderId !== o.orderId)].slice(0, 20);
    localStorage.setItem(`pedidos:${storeId}`, JSON.stringify(list));
  } catch {
    /* modo privado: el link igual llega por email */
  }
}
