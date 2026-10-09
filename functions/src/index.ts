/**
 * Servidor de la plataforma. Cada export es una función desplegada en Cloud Functions.
 * Todo cambio de dinero, stock o estado de pedido pasa por acá; las apps nunca lo escriben directo.
 */
import './config';

export { checkSubdomain, createStore, mpConnectStart, mpOAuthCallback, mpDisconnect } from './stores';
export { createCheckout } from './checkout';
export { saveProduct, deleteProduct } from './products';
export { mpWebhook, expireReservations } from './payments';
export { getMyOrder, cancelMyOrder, requestWithdrawal, updateOrderStatus, sendOrderLink } from './orderActions';
