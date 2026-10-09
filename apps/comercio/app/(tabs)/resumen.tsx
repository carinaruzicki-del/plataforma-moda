import { available, formatPesos, totalAvailable } from '@plataforma/core';
import { Link, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { storeLink } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Empty, Notice, P, Pill, s, Screen, Title } from '@/ui';
import { OrderRow } from '@/OrderRow';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 140, gap: 4 }}>
      <P small muted>{label}</P>
      <Title size={26}>{String(value)}</Title>
    </Card>
  );
}

export default function Summary() {
  const { store, products, orders } = useMerchant();
  if (!store) return <Screen><P muted>Cargando tu tienda…</P></Screen>;

  const published = products.filter((p) => p.published);
  const toPrepare = orders.filter((o) => o.status === 'pagado' || o.status === 'en_preparacion');
  const returns = orders.filter((o) => o.status === 'devolucion');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const sales = orders.filter((o) => o.payment.paidAt && o.payment.paidAt >= monthStart && !['cancelado', 'reembolsado'].includes(o.status));
  const low = products.flatMap((p) => p.variants.filter((v) => available(v) <= 2).map((v) => ({ p, v }))).slice(0, 8);

  return (
    <Screen>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Title>{store.name}</Title>
          <P small muted>{storeLink(store.subdomain)}</P>
        </View>
        <Button title="+ Prenda" small onPress={() => router.push('/prenda/nueva')} />
      </View>

      {!store.mpConnected && (
        <Pressable onPress={() => router.push('/configuracion/pagos')}>
          <Notice text="Conectá Mercado Pago para empezar a cobrar. Tocá acá." />
        </Pressable>
      )}
      {!store.pickup?.enabled && !store.flatShipping?.enabled && (
        <Pressable onPress={() => router.push('/configuracion/entregas')}>
          <Notice text="Configurá retiro en el local o envíos para que tus clientas puedan comprar." />
        </Pressable>
      )}

      <View style={s.row}>
        <Stat label="Ventas del mes" value={formatPesos(sales.reduce((a, o) => a + o.totals.total, 0))} />
        <Stat label="Pedidos para preparar" value={toPrepare.length} />
        <Stat label="Prendas publicadas" value={published.length} />
        <Stat label="Con stock" value={published.filter((p) => totalAvailable(p.variants) > 0).length} />
      </View>

      {returns.length > 0 && <Notice text={`Tenés ${returns.length} ${returns.length === 1 ? 'arrepentimiento' : 'arrepentimientos'} para gestionar.`} tone="bad" />}

      <Card>
        <View style={s.between}><Title size={20}>Para preparar</Title><Link href="/pedidos"><P style={{ color: '#754653' }}>Ver todos</P></Link></View>
        {toPrepare.length ? toPrepare.slice(0, 4).map((o) => <OrderRow key={o.id} o={o} />) : <P muted>No hay pedidos pendientes.</P>}
      </Card>

      <Card>
        <Title size={20}>Talles con poco stock</Title>
        {low.length ? (
          low.map(({ p, v }) => (
            <Pressable key={p.id + v.sku} onPress={() => router.push(`/prenda/${p.id}`)} style={s.between}>
              <P>{p.name} · talle {v.size}</P>
              <Pill label={available(v) <= 0 ? 'Agotado' : `Quedan ${available(v)}`} tone={available(v) <= 0 ? 'out' : 'low'} />
            </Pressable>
          ))
        ) : products.length ? (
          <P muted>Todo con buen stock.</P>
        ) : (
          <Empty title="Todavía no cargaste prendas" action={<Button title="Cargar la primera" onPress={() => router.push('/prenda/nueva')} />} />
        )}
      </Card>
    </Screen>
  );
}
