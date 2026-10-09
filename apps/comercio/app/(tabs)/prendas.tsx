import { CATEGORY_LABEL, formatPesos, totalAvailable, type Product } from '@plataforma/core';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { mediaUrl } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Chip, Empty, P, Pill, s, Screen } from '@/ui';

function missing(p: Product) {
  const m: string[] = [];
  if (!p.occasions.length) m.push('ocasión');
  if (!p.styles.length) m.push('estilo');
  if (!p.media.length) m.push('fotos');
  return m;
}

export default function Products() {
  const { products } = useMerchant();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'todas' | 'publicadas' | 'ocultas' | 'sin_stock' | 'incompletas'>('todas');

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return products.filter((p) => {
      if (n && ![p.name, p.brand, p.color].join(' ').toLowerCase().includes(n)) return false;
      if (filter === 'publicadas') return p.published;
      if (filter === 'ocultas') return !p.published;
      if (filter === 'sin_stock') return totalAvailable(p.variants) <= 0;
      if (filter === 'incompletas') return missing(p).length > 0;
      return true;
    });
  }, [products, q, filter]);

  return (
    <Screen>
      <View style={s.between}>
        <P muted>{products.length} prendas</P>
        <Button title="+ Cargar prenda" small onPress={() => router.push('/prenda/nueva')} />
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder="Buscar prenda…" style={s.input} placeholderTextColor="#A39C96" />
      <View style={s.row}>
        {([['todas', 'Todas'], ['publicadas', 'Publicadas'], ['ocultas', 'Ocultas'], ['sin_stock', 'Sin stock'], ['incompletas', 'Le faltan datos']] as const).map(([k, l]) => (
          <Chip key={k} label={l} on={filter === k} onPress={() => setFilter(k)} />
        ))}
      </View>
      {list.length ? (
        <Card style={{ padding: 8, gap: 0 }}>
          {list.map((p) => {
            const cover = p.media.find((m) => m.type === 'image');
            const stock = totalAvailable(p.variants);
            const miss = missing(p);
            return (
              <Pressable key={p.id} onPress={() => router.push(`/prenda/${p.id}`)} style={({ pressed }) => [{ flexDirection: 'row', gap: 12, padding: 8, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
                <View style={{ width: 52, height: 64, borderRadius: 9, overflow: 'hidden', backgroundColor: '#EEE8E1' }}>
                  {cover ? <Image source={{ uri: mediaUrl(cover.path) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <P style={{ fontFamily: 'Manrope_600SemiBold' }}>{p.name}</P>
                  <P small muted>{CATEGORY_LABEL[p.category]} · {p.line} · {formatPesos(p.price)}</P>
                  <P small muted>{p.variants.map((v) => `${v.size} (${v.stock})`).join(' · ')}</P>
                  {miss.length ? <P small style={{ color: '#8A6234' }}>Para el asesor falta: {miss.join(', ')}</P> : null}
                </View>
                <Pill label={!p.published ? 'Oculta' : stock <= 0 ? 'Sin stock' : 'Publicada'} tone={!p.published ? 'low' : stock <= 0 ? 'out' : 'ok'} />
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Empty
          title={products.length ? 'No hay prendas con ese filtro' : 'Todavía no cargaste prendas'}
          text={products.length ? undefined : 'Subí fotos o videos, talles y stock. Completá ocasión y estilo para que el asesor las recomiende.'}
          action={products.length ? undefined : <Button title="Cargar la primera" onPress={() => router.push('/prenda/nueva')} />}
        />
      )}
    </Screen>
  );
}
