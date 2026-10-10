import type { BannerLayout, BannerSlide, SizeGuideRow } from '@plataforma/core';
import { Image } from 'expo-image';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { db, errorMessage, mediaUrl } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { pickAndUpload } from '@/lib/upload';
import { Button, Card, Chips, Field, Label, Notice, P, s, Screen, Title } from '@/ui';

export default function HomeSettingsScreen() {
  const { storeId, home, sections } = useMerchant();
  const [banner, setBanner] = useState<BannerSlide[]>([]);
  const [guide, setGuide] = useState<SizeGuideRow[]>([]);
  const [layout, setLayout] = useState<BannerLayout>('carrusel');
  const [autoplay, setAutoplay] = useState(true);
  const [interval, setIntervalSec] = useState(6);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  useEffect(() => {
    if (loaded) return;
    setBanner(home.banner);
    setGuide(home.sizeGuide);
    setLayout(home.bannerLayout ?? 'carrusel');
    setAutoplay(home.bannerAutoplay ?? true);
    setIntervalSec(home.bannerIntervalSec ?? 6);
    setLoaded(true);
  }, [home, loaded]);

  if (!storeId) return null;

  async function add() {
    if (!storeId) return;
    setUploading(true);
    const r = await pickAndUpload(storeId, { multiple: true, allowVideo: true });
    setBanner((b) => [...b, ...r.media.map((m) => ({ media: m, title: '', subtitle: '', sectionId: null }))]);
    if (r.errors.length) setMsg({ text: r.errors[0]!, tone: 'bad' });
    setUploading(false);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await setDoc(doc(db, 'stores', storeId!, 'settings', 'home'), {
        banner: banner.map((b) => ({ media: b.media, title: b.title?.trim() ?? '', subtitle: b.subtitle?.trim() ?? '', sectionId: b.sectionId ?? null })),
        bannerLayout: layout,
        bannerAutoplay: autoplay,
        bannerIntervalSec: interval,
        sizeGuide: guide.filter((g) => g.size.trim()).map((g) => ({ size: g.size.trim(), equivalence: g.equivalence ?? '', bustCm: g.bustCm ?? '', waistCm: g.waistCm ?? '', hipCm: g.hipCm ?? '' })),
      });
      setMsg({ text: 'Guardado. Ya se ve en la tienda.', tone: 'ok' });
    } catch (e) {
      setMsg({ text: errorMessage(e), tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  const upd = (i: number, patch: Partial<BannerSlide>) => setBanner(banner.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const updG = (i: number, patch: Partial<SizeGuideRow>) => setGuide(guide.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= banner.length) return;
    const b = [...banner];
    [b[i], b[j]] = [b[j]!, b[i]!];
    setBanner(b);
  };

  return (
    <Screen>
      <Card>
        <Title size={22}>Banner de portada</Title>
        <P small muted>Ocupa todo el ancho de la tienda. Fotos o videos MP4.</P>
        <View>
          <Label>¿Cómo se muestra?</Label>
          <Chips
            options={['carrusel', 'fija', 'mosaico'] as const}
            value={layout}
            onChange={setLayout}
            labels={{ carrusel: 'Carrusel', fija: 'Una sola foto o video', mosaico: 'Mosaico (2 o 3 juntas)' }}
          />
          <P small muted>
            {layout === 'carrusel'
              ? 'Se pasan una tras otra, en este orden. Los videos avanzan cuando terminan.'
              : layout === 'fija'
                ? 'Se muestra solo la primera de la lista.'
                : 'Se ven las primeras 2 o 3 una al lado de la otra; la primera lleva el texto. En el celular quedan apiladas.'}
          </P>
        </View>
        {layout === 'carrusel' && (
          <View style={{ gap: 8 }}>
            <View style={s.between}>
              <P>Pasar solas</P>
              <Switch value={autoplay} onValueChange={setAutoplay} trackColor={{ true: '#754653', false: '#E7E1DB' }} thumbColor="#fff" />
            </View>
            {autoplay && (
              <Chips options={['4', '6', '8', '10'] as const} value={String(interval) as '4' | '6' | '8' | '10'} onChange={(v) => setIntervalSec(Number(v))}
                labels={{ '4': 'Cada 4 s', '6': 'Cada 6 s', '8': 'Cada 8 s', '10': 'Cada 10 s' }} />
            )}
          </View>
        )}
        {banner.map((b, i) => (
          <View key={b.media.path} style={{ gap: 10, borderWidth: 1, borderColor: '#E7E1DB', borderRadius: 14, padding: 10 }}>
            <View style={{ height: 120, borderRadius: 10, overflow: 'hidden', backgroundColor: '#EEE8E1' }}>
              {b.media.type === 'image' ? (
                <Image source={{ uri: mediaUrl(b.media.path) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 28, color: '#754653' }}>▶</Text></View>
              )}
            </View>
            <Field label="Título" value={b.title ?? ''} onChangeText={(t) => upd(i, { title: t })} placeholder="Ej.: Llegó la nueva temporada" />
            <Field label="Texto" value={b.subtitle ?? ''} onChangeText={(t) => upd(i, { subtitle: t })} placeholder="Ej.: Prendas livianas para el calor" />
            {sections.length > 0 && (
              <View>
                <Label>El botón lleva a</Label>
                <Chips
                  options={['', ...sections.map((x) => x.id)]}
                  value={b.sectionId ?? ''}
                  onChange={(v) => upd(i, { sectionId: v || null })}
                  labels={{ '': 'Todas las prendas', ...Object.fromEntries(sections.map((x) => [x.id, x.name])) }}
                />
              </View>
            )}
            <View style={s.row}>
              <Button title="↑" variant="ghost" small onPress={() => move(i, -1)} disabled={i === 0} />
              <Button title="↓" variant="ghost" small onPress={() => move(i, 1)} disabled={i === banner.length - 1} />
              <Button title="Quitar" variant="danger" small onPress={() => setBanner(banner.filter((_, j) => j !== i))} />
            </View>
          </View>
        ))}
        <Button title={uploading ? 'Subiendo…' : '＋ Subir fotos o videos'} variant="outline" onPress={add} disabled={uploading} />
      </Card>

      <Card>
        <Title size={22}>Guía de talles</Title>
        <P small muted>No hay una equivalencia universal: cargá la de tu local (por ejemplo, 1 = S). Medidas del cuerpo en centímetros.</P>
        {guide.map((g, i) => (
          <View key={i} style={[s.row, { alignItems: 'center' }]}>
            {(['size', 'equivalence', 'bustCm', 'waistCm', 'hipCm'] as const).map((k) => (
              <TextInput
                key={k}
                value={g[k] ?? ''}
                onChangeText={(t) => updG(i, { [k]: t })}
                placeholder={{ size: 'Talle', equivalence: 'Equivale', bustCm: 'Busto', waistCm: 'Cintura', hipCm: 'Cadera' }[k]}
                style={[s.input, { flex: 1, minWidth: 70 }]}
              />
            ))}
            <Button title="✕" variant="danger" small onPress={() => setGuide(guide.filter((_, j) => j !== i))} />
          </View>
        ))}
        <Button title="+ Agregar talle" variant="ghost" small onPress={() => setGuide([...guide, { size: '' }])} />
      </Card>

      {msg && <Notice text={msg.text} tone={msg.tone} />}
      <Button title="Guardar cambios" onPress={save} loading={busy} disabled={uploading} />
    </Screen>
  );
}
