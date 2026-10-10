import {
  CATEGORIES,
  CATEGORY_LABEL,
  DEFAULT_SIZE_SYSTEM,
  SIZE_SYSTEM_LABEL,
  SIZE_SYSTEMS,
  sortSizes,
  type SizeSystem,
  FITLESS_CATEGORIES,
  FIT_LABEL,
  FITS,
  LINES,
  OCCASIONS,
  STYLES,
  productInputSchema,
  type Category,
  type Fit,
  type Line,
  type Media,
  type Occasion,
  type Style,
} from '@plataforma/core';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { callFn, errorMessage, mediaUrl } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { pickAndUpload } from '@/lib/upload';
import { Button, Card, Chip, Chips, Field, Label, MultiChips, Notice, P, s, Screen, Title } from '@/ui';

interface VariantDraft {
  sku: string;
  size: string;
  stock: string;
  /** Unidades apartadas por compras en curso (solo para mostrar). */
  reserved: number;
}

const SYSTEMS = Object.keys(SIZE_SYSTEMS) as SizeSystem[];

/** El sistema de talles que mejor describe los talles ya cargados. */
function guessSystem(sizes: string[], category: Category): SizeSystem {
  if (!sizes.length) return DEFAULT_SIZE_SYSTEM[category];
  return SYSTEMS.find((k) => sizes.every((x) => (SIZE_SYSTEMS[k] as readonly string[]).includes(x))) ?? DEFAULT_SIZE_SYSTEM[category];
}

const newSku = () => `V${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

function confirm(title: string, message: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    // En la web no hay Alert con botones: se usa la confirmación del navegador.
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [{ text: 'Volver', style: 'cancel' }, { text: ok, style: 'destructive', onPress: onOk }]);
}

export default function ProductEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nueva';
  const { storeId, products, sections } = useMerchant();
  const existing = isNew ? undefined : products.find((p) => p.id === id);

  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<Category>('Arriba');
  const [line, setLine] = useState<Line>('Mujer');
  const [color, setColor] = useState('');
  const [fit, setFit] = useState<Fit | null>('Regular');
  const [styles, setStyles] = useState<Style[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [price, setPrice] = useState('');
  const [compareAt, setCompareAt] = useState('');
  const [media, setMedia] = useState<Media[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [system, setSystem] = useState<SizeSystem>('letras');
  const [customSize, setCustomSize] = useState('');
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [published, setPublished] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing || loaded) return;
    setName(existing.name);
    setDescription(existing.description);
    setBrand(existing.brand ?? '');
    setCategory(existing.category);
    setLine(existing.line);
    setColor(existing.color);
    setFit(existing.fit ?? null);
    setStyles(existing.styles);
    setOccasions(existing.occasions);
    setPrice(String(existing.price));
    setCompareAt(existing.compareAtPrice ? String(existing.compareAtPrice) : '');
    setMedia(existing.media);
    setVariants(existing.variants.map((v) => ({ sku: v.sku, size: v.size, stock: String(v.stock), reserved: v.reserved })));
    setSystem(guessSystem(existing.variants.map((v) => v.size), existing.category));
    setSectionIds(existing.sectionIds);
    setPublished(existing.published);
    setLoaded(true);
  }, [existing, loaded]);

  // En una prenda nueva sin stock cargado, el sistema de talles sigue al tipo de prenda.
  useEffect(() => {
    if (isNew && variants.every((v) => !Number(v.stock))) setSystem(DEFAULT_SIZE_SYSTEM[category]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, isNew]);

  if (!storeId) return null;

  const sorted = (() => {
    const order = sortSizes(variants.map((v) => v.size));
    return [...variants].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));
  })();
  const hasSize = (size: string) => variants.some((v) => v.size === size);
  function toggleSize(size: string) {
    const v = variants.find((x) => x.size === size);
    if (!v) return setVariants([...variants, { sku: newSku(), size, stock: '0', reserved: 0 }]);
    if (v.reserved > 0) return setError(`El talle ${size} tiene unidades en compras en curso: no se puede sacar ahora.`);
    setVariants(variants.filter((x) => x.size !== size));
  }
  function addCustom() {
    const size = customSize.trim();
    if (!size || hasSize(size)) return setCustomSize('');
    setVariants([...variants, { sku: newSku(), size, stock: '0', reserved: 0 }]);
    setCustomSize('');
  }
  function selectAll() {
    const all = SIZE_SYSTEMS[system] as readonly string[];
    setVariants([...variants, ...all.filter((x) => !hasSize(x)).map((size) => ({ sku: newSku(), size, stock: '0', reserved: 0 }))]);
  }
  if (!isNew && !existing) return <Screen><P muted>Cargando prenda…</P></Screen>;

  const fitless = FITLESS_CATEGORIES.includes(category);

  async function upload() {
    if (!storeId) return;
    setUploading(true);
    const r = await pickAndUpload(storeId, { multiple: true, allowVideo: true });
    setMedia((m) => [...m, ...r.media].slice(0, 12));
    if (r.errors.length) setError(r.errors[0]!);
    setUploading(false);
  }

  async function save() {
    setError('');
    const candidate = {
      name,
      description,
      ...(brand.trim() ? { brand } : {}),
      category,
      line,
      color,
      fit: fitless ? null : fit,
      styles,
      occasions,
      price: Number(price.replace(/\./g, '').replace(',', '.')),
      compareAtPrice: compareAt ? Number(compareAt.replace(/\./g, '').replace(',', '.')) : null,
      media,
      variants: variants.filter((v) => v.size.trim()).map((v) => ({ sku: v.sku, size: v.size.trim(), stock: Math.max(0, parseInt(v.stock, 10) || 0) })),
      sectionIds,
      published,
    };
    const parsed = productInputSchema.safeParse(candidate);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
    setBusy(true);
    try {
      await callFn('saveProduct', { storeId, ...(isNew ? {} : { productId: id }), product: parsed.data });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    confirm('¿Borrar esta prenda?', 'No se puede deshacer. Si solo querés que no se vea, ocultala.', 'Borrar', async () => {
      try {
        await callFn('deleteProduct', { storeId, productId: id });
        router.back();
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Cargar prenda' : 'Editar prenda' }} />

      <Card>
        <Title size={20}>Fotos y videos</Title>
        <P small muted>La primera es la portada. Videos MP4 de hasta 60 segundos.</P>
        <View style={s.row}>
          {media.map((m, i) => (
            <View key={m.path} style={{ width: 96, height: 120, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEE8E1' }}>
              {m.type === 'image' ? (
                <Image source={{ uri: mediaUrl(m.path) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, color: '#754653' }}>▶</Text><P small muted>Video</P></View>
              )}
              <View style={{ position: 'absolute', left: 4, right: 4, bottom: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                {i > 0 ? (
                  <Pressable onPress={() => setMedia([m, ...media.filter((x) => x !== m)])} style={{ backgroundColor: '#fffe', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11 }}>Portada</Text>
                  </Pressable>
                ) : <View />}
                <Pressable accessibilityLabel="Quitar archivo" onPress={() => setMedia(media.filter((x) => x !== m))} style={{ backgroundColor: '#fffe', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11 }}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable onPress={upload} disabled={uploading || media.length >= 12} style={{ width: 96, height: 120, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CDBFC3', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
            <Text style={{ color: '#754653', fontFamily: 'Manrope_600SemiBold', textAlign: 'center', fontSize: 12 }}>{uploading ? 'Subiendo…' : '＋ Subir fotos o videos'}</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <View style={s.row}>
          <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej.: Camisa de lino" />
          <Field label="Marca (opcional)" value={brand} onChangeText={setBrand} />
        </View>
        <Field label="Descripción" value={description} onChangeText={setDescription} multiline placeholder="Tela, detalles, cuidados…" />
        <View style={s.row}>
          <Field label="Precio ($)" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="45000" />
          <Field label="Precio anterior (opcional)" value={compareAt} onChangeText={setCompareAt} keyboardType="numeric" placeholder="Para mostrar rebaja" />
          <Field label="Color" value={color} onChangeText={setColor} placeholder="Ej.: crudo" />
        </View>
        <View><Label>Tipo de prenda</Label><Chips options={CATEGORIES} value={category} onChange={setCategory} labels={CATEGORY_LABEL} /></View>
        <View><Label>Colección</Label><Chips options={LINES} value={line} onChange={setLine} /></View>
        {!fitless && <View><Label>Calce</Label><Chips options={FITS} value={fit} onChange={setFit} labels={FIT_LABEL} /></View>}
      </Card>

      <Card>
        <Title size={20}>Talles y stock</Title>
        <View>
          <Label>Tipo de talle</Label>
          <Chips options={SYSTEMS} value={system} onChange={setSystem} labels={SIZE_SYSTEM_LABEL} />
        </View>
        <View>
          <View style={s.between}>
            <Label>Tocá los talles que tenés</Label>
            {SIZE_SYSTEMS[system].length > 1 && <Button title="Todos" variant="ghost" small onPress={selectAll} />}
          </View>
          <View style={s.row}>
            {SIZE_SYSTEMS[system].map((size) => <Chip key={size} label={size} on={hasSize(size)} onPress={() => toggleSize(size)} />)}
          </View>
        </View>
        <View style={[s.row, { alignItems: 'center' }]}>
          <TextInput value={customSize} onChangeText={setCustomSize} onSubmitEditing={addCustom} placeholder="Otro talle (ej.: 2 años, 85B)" style={[s.input, { flex: 1, minWidth: 160 }]} />
          <Button title="+ Agregar" variant="ghost" small onPress={addCustom} />
        </View>
        {sorted.length === 0 ? (
          <P small muted>Elegí al menos un talle y cargá cuántas unidades tenés de cada uno.</P>
        ) : (
          <View style={{ gap: 8 }}>
            <Label>Unidades por talle</Label>
            {sorted.map((v) => (
              <View key={v.sku} style={[s.row, { alignItems: 'center' }]}>
                <View style={{ minWidth: 64, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F2E8EB' }}>
                  <Text style={{ fontFamily: 'Manrope_600SemiBold', color: '#754653', textAlign: 'center' }}>{v.size}</Text>
                </View>
                <TextInput
                  value={v.stock}
                  onChangeText={(t) => setVariants(variants.map((x) => (x.sku === v.sku ? { ...x, stock: t.replace(/\D/g, '') } : x)))}
                  keyboardType="number-pad"
                  placeholder="Unidades"
                  accessibilityLabel={`Unidades del talle ${v.size}`}
                  style={[s.input, { flex: 1, minWidth: 90 }]}
                />
                {v.reserved > 0 ? <P small muted>{v.reserved} en compras</P> : null}
                <Button title="✕" variant="danger" small onPress={() => toggleSize(v.size)} disabled={v.reserved > 0} />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Title size={20}>Para el asesor ¿Qué me pongo?</Title>
        <P small muted>Con ocasión y estilo, la prenda aparece en los looks que se arman para tus clientas.</P>
        <View><Label>Ocasiones</Label><MultiChips options={OCCASIONS} value={occasions} onChange={setOccasions} /></View>
        <View><Label>Estilos</Label><MultiChips options={STYLES} value={styles} onChange={setStyles} /></View>
      </Card>

      <Card>
        <Title size={20}>Secciones</Title>
        {sections.length ? (
          <MultiChips options={sections.map((x) => x.id)} value={sectionIds} onChange={setSectionIds} labels={Object.fromEntries(sections.map((x) => [x.id, x.name]))} />
        ) : (
          <P small muted>Todavía no creaste secciones. Las armás en Mi tienda → Secciones.</P>
        )}
        <View style={s.between}>
          <P>Publicada en la tienda</P>
          <Switch value={published} onValueChange={setPublished} trackColor={{ true: '#754653', false: '#E7E1DB' }} thumbColor="#fff" />
        </View>
      </Card>

      {error ? <Notice text={error} tone="bad" /> : null}
      <Button title="Guardar prenda" onPress={save} loading={busy} disabled={uploading} />
      {!isNew && <Button title="Borrar prenda" variant="danger" onPress={remove} />}
    </Screen>
  );
}
