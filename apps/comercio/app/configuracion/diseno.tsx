import {
  cheapestPlanWith,
  colors,
  DEFAULT_PLANS,
  designFeatures,
  DISPLAY_FONTS,
  isHexColor,
  LAYOUTS,
  PALETTES,
  PLATFORM_NAME,
  resolveTheme,
  type StoreTheme,
} from '@plataforma/core';
import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { db, errorMessage } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Chip, Field, font, Label, Notice, P, Pill, s, Screen, Title } from '@/ui';

/** "Disponible en Esencial": el plan más barato que trae esa función. */
function locked(test: Parameters<typeof cheapestPlanWith>[0]) {
  const p = cheapestPlanWith(test);
  return p ? `Disponible desde el plan ${p.name}` : 'No disponible';
}

export default function Design() {
  const { store, storeId } = useMerchant();
  const [t, setT] = useState<StoreTheme>({});
  const [hex, setHex] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  useEffect(() => {
    if (!store || loaded) return;
    const theme = store.theme ?? {};
    const legacyPalette = PALETTES.find((p) => p.accent.toUpperCase() === store.accentColor?.toUpperCase());
    setT({ ...theme, palette: theme.palette ?? legacyPalette?.id ?? 'ciruela' });
    setHex(theme.accent ?? '');
    setLoaded(true);
  }, [store, loaded]);

  const features = designFeatures(store?.plan);
  const draft: StoreTheme = useMemo(() => ({ ...t, ...(isHexColor(hex) ? { accent: hex.toUpperCase() } : { accent: undefined }) }), [t, hex]);
  const preview = useMemo(() => resolveTheme(draft, features), [draft, features]);

  if (!store || !storeId) return null;
  const planName = DEFAULT_PLANS[store.plan]?.name ?? store.plan;

  async function save() {
    if (hex && !isHexColor(hex)) return setMsg({ text: 'El color tiene que tener el formato #RRGGBB, por ejemplo #1F3A5F.', tone: 'bad' });
    setBusy(true);
    setMsg(null);
    try {
      const theme: StoreTheme = {};
      if (draft.palette) theme.palette = draft.palette;
      if (draft.accent) theme.accent = draft.accent;
      if (draft.font) theme.font = draft.font;
      if (draft.layout) theme.layout = draft.layout;
      await updateDoc(doc(db, 'stores', storeId!), { theme, updatedAt: Date.now() });
      setMsg({ text: 'Guardado. Ya se ve así en tu tienda.', tone: 'ok' });
    } catch (e) {
      setMsg({ text: errorMessage(e), tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={s.between}>
        <Title size={24}>Diseño de tu tienda</Title>
        <Pill label={`Plan ${planName}`} />
      </View>

      {/* Vista previa */}
      <Card style={{ gap: 10 }}>
        <Label>Así se ve</Label>
        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
          <View style={{ backgroundColor: colors.surface, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: preview.layout === 'editorial' ? 'center' : 'flex-start' }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: preview.accent }} />
            <Text style={{ fontFamily: font.display, fontSize: 18, color: colors.ink }}>{store.name}</Text>
          </View>
          <View style={{ backgroundColor: preview.accent, padding: 18, gap: 8 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontFamily: font.display }}>Nueva temporada</Text>
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: preview.layout === 'minimal' ? 4 : 999, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: preview.accent, fontFamily: font.semibold }}>Armar mi look →</Text>
            </View>
          </View>
          <View style={{ backgroundColor: colors.paper, padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: preview.accent, fontFamily: font.semibold }}>Ver prendas</Text>
            {preview.branding && <Text style={{ color: colors.muted, fontSize: 12 }}>Creada con {PLATFORM_NAME}</Text>}
          </View>
        </View>
        {preview.font.id !== 'fraunces' && <P small muted>Los títulos de la tienda usan {preview.font.name}.</P>}
        {preview.adjusted && <Notice text={`Oscurecimos un poco tu color (${preview.accent}) para que los textos se lean bien.`} />}
      </Card>

      {/* Paletas: todos los planes */}
      <Card>
        <Label>Paleta de colores</Label>
        <View style={s.row}>
          {PALETTES.map((p) => {
            const on = t.palette === p.id && !(features.freeColor && isHexColor(hex));
            return (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} accessibilityState={{ selected: on }}
                onPress={() => { setT({ ...t, palette: p.id }); setHex(''); }}
                style={{ alignItems: 'center', gap: 4, width: 72 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.accent, borderWidth: on ? 3 : 0, borderColor: '#E7CBD4' }} />
                <P small muted={!on}>{p.name}</P>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Color libre */}
      <Card>
        <View style={s.between}>
          <Label>Color exacto de tu marca</Label>
          {!features.freeColor && <Pill label={locked((d) => d.freeColor)} tone="out" />}
        </View>
        {features.freeColor ? (
          <View style={[s.row, { alignItems: 'flex-end' }]}>
            <Field label="Código del color" value={hex} onChangeText={(v) => setHex(v.trim().startsWith('#') || !v ? v.trim() : `#${v.trim()}`)}
              autoCapitalize="characters" placeholder="#1F3A5F" maxLength={7} />
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isHexColor(hex) ? hex : colors.sand, borderWidth: 1, borderColor: colors.line }} />
            {hex ? <Button title="Usar la paleta" variant="ghost" small onPress={() => setHex('')} /> : null}
          </View>
        ) : (
          <P small muted>Con un plan pago ponés el código exacto del color de tu marca. En tu plan elegís entre las paletas de arriba.</P>
        )}
      </Card>

      {/* Tipografía */}
      <Card>
        <View style={s.between}>
          <Label>Tipografía de los títulos</Label>
          {!features.fontChoice && <Pill label={locked((d) => d.fontChoice)} tone="out" />}
        </View>
        <View style={s.row}>
          {DISPLAY_FONTS.map((f) => (
            <Chip key={f.id} label={f.name} on={(t.font ?? 'fraunces') === f.id}
              onPress={features.fontChoice ? () => setT({ ...t, font: f.id }) : undefined} />
          ))}
        </View>
        {!features.fontChoice && <P small muted>Tu tienda usa Fraunces, la tipografía de la plataforma.</P>}
      </Card>

      {/* Diseños */}
      <Card>
        <Label>Diseño</Label>
        {LAYOUTS.map((l) => {
          const allowed = features.layouts.includes(l.id);
          const on = (t.layout ?? 'clasico') === l.id;
          return (
            <Pressable key={l.id} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !allowed }}
              onPress={allowed ? () => setT({ ...t, layout: l.id }) : undefined}
              style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: on ? '#D5BDC4' : colors.line, backgroundColor: on ? colors.plumSoft : colors.surface, opacity: allowed ? 1 : 0.6, gap: 2 }}>
              <View style={s.between}>
                <P style={{ fontFamily: font.semibold }}>{l.name}</P>
                {!allowed && <Pill label={locked((d) => d.layouts.includes(l.id))} tone="out" />}
              </View>
              <P small muted>{l.description}</P>
            </Pressable>
          );
        })}
      </Card>

      {features.branding && (
        <P small muted>En el plan {planName} el pie de la tienda muestra “Creada con {PLATFORM_NAME}”. Con un plan pago se saca.</P>
      )}
      {msg && <Notice text={msg.text} tone={msg.tone} />}
      <Button title="Guardar diseño" onPress={save} loading={busy} />
    </Screen>
  );
}
