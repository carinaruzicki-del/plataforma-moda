import { formatPesos, nextStatuses, STATUS_LABEL, withdrawalDeadline, type OrderStatus } from '@plataforma/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { callFn, errorMessage } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { STATUS_TONE } from '@/OrderRow';
import { Button, Card, Field, Notice, P, Pill, s, Screen, Title } from '@/ui';

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  en_preparacion: 'Empezar a preparar',
  listo_para_retirar: 'Avisar que está listo para retirar',
  despachado: 'Marcar como despachado',
  entregado: 'Marcar como entregado',
  reembolsado: 'Recibí la prenda: reembolsar',
  cancelado: 'Cancelar pedido',
};

function ask(title: string, msg: string, ok: string, fn: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${msg}`)) fn();
  } else {
    Alert.alert(title, msg, [{ text: 'Volver', style: 'cancel' }, { text: ok, onPress: fn }]);
  }
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, storeId } = useMerchant();
  const o = orders.find((x) => x.id === id);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState('');

  if (!o || !storeId) return <Screen><P muted>Cargando pedido…</P></Screen>;

  const actions = nextStatuses(o.status, 'comercio').filter((to) => to !== 'entregado' || o.status !== 'devolucion');
  const rejectReturn = o.status === 'devolucion';

  async function move(to: OrderStatus) {
    setBusy(to);
    setError('');
    try {
      await callFn('updateOrderStatus', {
        storeId,
        orderId: o!.id,
        to,
        ...(to === 'despachado' ? { tracking: { ...(carrier ? { carrier } : {}), ...(tracking ? { trackingNumber: tracking } : {}), ...(trackingUrl ? { trackingUrl } : {}) } } : {}),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const run = (to: OrderStatus) => {
    if (to === 'cancelado') {
      ask('¿Cancelar el pedido?', o.payment.paymentId ? 'Se reembolsa el total a la clienta por Mercado Pago y el stock vuelve a la tienda.' : 'Se libera el stock apartado.', 'Cancelar pedido', () => move(to));
    } else if (to === 'reembolsado') {
      ask('¿Recibiste la prenda?', `Se le devuelven ${formatPesos(o.totals.total)} a la clienta por Mercado Pago y el stock vuelve a la tienda.`, 'Reembolsar', () => move(to));
    } else {
      void move(to);
    }
  };

  const phone = o.customer.phone.replace(/\D/g, '');
  const a = o.delivery.address;

  return (
    <Screen>
      <Stack.Screen options={{ title: `Pedido ${o.number}` }} />
      <View style={s.between}>
        <Title>{o.customer.name}</Title>
        <Pill label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
      </View>
      {o.status === 'devolucion' && (
        <Notice tone="bad" text="La clienta pidió el arrepentimiento. Coordiná la devolución (el envío lo paga la tienda) y, cuando recibas la prenda, reembolsá desde acá." />
      )}
      {o.status === 'pago_pendiente' && <Notice text="Esperando el pago. Si no se paga a tiempo, se cancela solo y se libera el stock." />}

      <Card>
        <Title size={18}>Prendas</Title>
        {o.items.map((i) => (
          <View key={i.sku} style={s.between}>
            <P>{i.name} · talle {i.size} × {i.quantity}</P>
            <P>{formatPesos(i.unitPrice * i.quantity)}</P>
          </View>
        ))}
        <View style={s.between}><P muted>Envío</P><P muted>{o.totals.shipping ? formatPesos(o.totals.shipping) : 'Sin costo'}</P></View>
        <View style={s.between}><P style={{ fontFamily: 'Manrope_700Bold' }}>Total</P><P style={{ fontFamily: 'Manrope_700Bold' }}>{formatPesos(o.totals.total)}</P></View>
        <P small muted>Comisión de la plataforma: {formatPesos(o.totals.platformFee)} ({o.totals.commissionPct}%). Mercado Pago descuenta además su propia comisión.</P>
        {o.note ? <Notice text={`Nota de la clienta: ${o.note}`} /> : null}
      </Card>

      <Card>
        <Title size={18}>Clienta y entrega</Title>
        <P>{o.customer.email}</P>
        <P>{o.customer.phone}</P>
        <View style={s.row}>
          {phone ? <Button title="WhatsApp" variant="ghost" small onPress={() => Linking.openURL(`https://wa.me/${phone.startsWith('54') ? phone : `54${phone}`}`)} /> : null}
          <Button title="Email" variant="ghost" small onPress={() => Linking.openURL(`mailto:${o.customer.email}?subject=Pedido ${o.number}`)} />
        </View>
        <P>{o.delivery.method === 'retiro' ? 'Retira en el local' : 'Envío a domicilio'}</P>
        {a ? <P muted>{`${a.street} ${a.number}${a.floor ? `, ${a.floor}` : ''} · ${a.city}, ${a.province} (${a.postalCode})${a.notes ? ` · ${a.notes}` : ''}`}</P> : null}
        {o.delivery.trackingNumber ? <P>Seguimiento: {o.delivery.carrier ? `${o.delivery.carrier} ` : ''}{o.delivery.trackingNumber}</P> : null}
        {o.deliveredAt ? <P small muted>Entregado. La clienta puede arrepentirse hasta el {new Date(withdrawalDeadline(o.deliveredAt)).toLocaleDateString('es-AR')}.</P> : null}
      </Card>

      {actions.includes('despachado') && (
        <Card>
          <Title size={18}>Datos del envío</Title>
          <View style={s.row}>
            <Field label="Correo o mensajería" value={carrier} onChangeText={setCarrier} placeholder="Ej.: Andreani" />
            <Field label="Número de seguimiento" value={tracking} onChangeText={setTracking} />
          </View>
          <Field label="Link de seguimiento (opcional)" value={trackingUrl} onChangeText={setTrackingUrl} autoCapitalize="none" keyboardType="url" />
        </Card>
      )}

      {error ? <Notice text={error} tone="bad" /> : null}
      {actions
        .filter((to) => to !== 'cancelado')
        .map((to) => (
          <Button key={to} title={ACTION_LABEL[to] ?? STATUS_LABEL[to]} onPress={() => run(to)} loading={busy === to} />
        ))}
      {rejectReturn && <Button title="Rechazar devolución" variant="ghost" onPress={() => ask('¿Rechazar la devolución?', 'El pedido vuelve a "Entregado". Usalo solo si la prenda no cumple las condiciones.', 'Rechazar', () => move('entregado'))} />}
      {actions.includes('cancelado') && <Button title="Cancelar pedido" variant="danger" onPress={() => run('cancelado')} loading={busy === 'cancelado'} />}

      <Card>
        <Title size={18}>Historial</Title>
        {o.history.map((h) => (
          <P key={`${h.to}-${h.at}`} small muted>
            {new Date(h.at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {STATUS_LABEL[h.to]}
            {h.note ? ` · ${h.note}` : ''}
          </P>
        ))}
      </Card>
    </Screen>
  );
}
