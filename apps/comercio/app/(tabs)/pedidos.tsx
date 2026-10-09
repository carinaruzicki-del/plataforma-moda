import type { OrderStatus } from '@plataforma/core';
import { useState } from 'react';
import { View } from 'react-native';
import { useMerchant } from '@/lib/merchant';
import { OrderRow } from '@/OrderRow';
import { Card, Chip, Empty, s, Screen } from '@/ui';

const FILTERS: Array<[string, string, OrderStatus[] | null]> = [
  ['preparar', 'Para preparar', ['pagado', 'en_preparacion']],
  ['listos', 'Listos o enviados', ['listo_para_retirar', 'despachado']],
  ['devoluciones', 'Devoluciones', ['devolucion']],
  ['entregados', 'Entregados', ['entregado']],
  ['pendientes', 'Sin pagar', ['pago_pendiente']],
  ['cancelados', 'Cancelados', ['cancelado', 'reembolsado']],
  ['todos', 'Todos', null],
];

export default function Orders() {
  const { orders } = useMerchant();
  const [f, setF] = useState('preparar');
  const statuses = FILTERS.find(([k]) => k === f)?.[2] ?? null;
  const list = statuses ? orders.filter((o) => statuses.includes(o.status)) : orders;
  return (
    <Screen>
      <View style={s.row}>
        {FILTERS.map(([k, l, st]) => {
          const n = st ? orders.filter((o) => st.includes(o.status)).length : orders.length;
          return <Chip key={k} label={`${l}${n ? ` · ${n}` : ''}`} on={f === k} onPress={() => setF(k)} />;
        })}
      </View>
      {list.length ? (
        <Card style={{ paddingVertical: 6 }}>{list.map((o) => <OrderRow key={o.id} o={o} />)}</Card>
      ) : (
        <Empty title="No hay pedidos acá" text="Las compras de tus clientas aparecen al instante, con aviso por email." />
      )}
    </Screen>
  );
}
