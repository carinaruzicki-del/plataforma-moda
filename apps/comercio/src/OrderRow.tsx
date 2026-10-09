import { formatPesos, STATUS_LABEL, type Order } from '@plataforma/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { P, Pill, s } from './ui';

export const STATUS_TONE: Record<Order['status'], 'ok' | 'low' | 'out' | 'accent' | 'bad'> = {
  pago_pendiente: 'out',
  pagado: 'low',
  en_preparacion: 'accent',
  listo_para_retirar: 'accent',
  despachado: 'accent',
  entregado: 'ok',
  cancelado: 'out',
  devolucion: 'bad',
  reembolsado: 'out',
};

export function OrderRow({ o }: { o: Order }) {
  const date = new Date(o.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const units = o.items.reduce((a, i) => a + i.quantity, 0);
  return (
    <Pressable onPress={() => router.push(`/pedido/${o.id}`)} style={({ pressed }) => [{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1EDE9', opacity: pressed ? 0.7 : 1 }]}>
      <View style={s.between}>
        <View style={{ flex: 1, gap: 2 }}>
          <P><P style={{ fontFamily: 'Manrope_700Bold' }}>{o.number}</P> · {o.customer.name}</P>
          <P small muted>{date} · {units} {units === 1 ? 'prenda' : 'prendas'} · {o.delivery.method === 'retiro' ? 'Retira' : 'Envío'} · {formatPesos(o.totals.total)}</P>
        </View>
        <Pill label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
      </View>
    </Pressable>
  );
}
