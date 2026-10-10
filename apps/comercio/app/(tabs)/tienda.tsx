import { DEFAULT_PLANS } from '@plataforma/core';
import { router, type Href } from 'expo-router';
import { signOut } from 'firebase/auth';
import { Linking, Pressable, View } from 'react-native';
import { auth, storeLink } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Chip, P, Pill, s, Screen, Title } from '@/ui';

export default function StoreMenu() {
  const { store, role, memberships, storeId, setStoreId, sections, home } = useMerchant();
  if (!store) return <Screen><P muted>Cargando…</P></Screen>;
  const owner = role === 'duena';

  const items: Array<{ href: Href; title: string; text: string; badge?: { label: string; tone: 'ok' | 'low' } ; ownerOnly?: boolean }> = [
    { href: '/configuracion/portada', title: 'Portada y guía de talles', text: `${home.banner.length} imágenes en el banner · ${home.sizeGuide.length} talles en la guía` },
    { href: '/configuracion/secciones', title: 'Secciones', text: `${sections.length} secciones para ordenar tus prendas` },
    {
      href: '/configuracion/entregas',
      title: 'Entregas',
      text: [store.pickup?.enabled && 'Retiro en el local', store.flatShipping?.enabled && `${store.flatShipping.zones.length} zonas de envío`].filter(Boolean).join(' · ') || 'Sin configurar',
      ownerOnly: true,
    },
    {
      href: '/configuracion/pagos',
      title: 'Cobros con Mercado Pago',
      text: 'Cobrá con tarjeta, débito, dinero en cuenta o efectivo',
      badge: store.mpConnected ? { label: 'Conectado', tone: 'ok' } : { label: 'Sin conectar', tone: 'low' },
      ownerOnly: true,
    },
    { href: '/configuracion/diseno', title: 'Diseño', text: 'Colores, tipografía y estructura de tu tienda', ownerOnly: true },
    { href: '/configuracion/datos', title: 'Datos de la tienda', text: 'Nombre, logo y contacto', ownerOnly: true },
  ];

  return (
    <Screen>
      <Title>{store.name}</Title>
      <View style={s.row}>
        <Button title="Ver mi tienda" variant="outline" small onPress={() => Linking.openURL(storeLink(store.subdomain))} />
        <Pill label={`Plan ${DEFAULT_PLANS[store.plan]?.name ?? store.plan}`} />
      </View>
      {memberships && memberships.length > 1 && (
        <Card>
          <P small muted>Tus tiendas</P>
          <View style={s.row}>{memberships.map((m) => <Chip key={m.storeId} label={m.storeId === storeId ? store.name : m.storeId.slice(0, 6)} on={m.storeId === storeId} onPress={() => setStoreId(m.storeId)} />)}</View>
        </Card>
      )}
      <Card style={{ padding: 6, gap: 0 }}>
        {items
          .filter((i) => owner || !i.ownerOnly)
          .map((i) => (
            <Pressable key={String(i.href)} onPress={() => router.push(i.href)} style={({ pressed }) => [{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1EDE9', opacity: pressed ? 0.7 : 1 }]}>
              <View style={s.between}>
                <View style={{ flex: 1, gap: 2 }}>
                  <P style={{ fontFamily: 'Manrope_600SemiBold' }}>{i.title}</P>
                  <P small muted>{i.text}</P>
                </View>
                {i.badge ? <Pill label={i.badge.label} tone={i.badge.tone} /> : <P muted>›</P>}
              </View>
            </Pressable>
          ))}
      </Card>
      <Button title="Cerrar sesión" variant="ghost" onPress={() => signOut(auth).then(() => router.replace('/login'))} />
    </Screen>
  );
}
