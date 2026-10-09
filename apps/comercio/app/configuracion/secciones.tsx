import { SECTION_KINDS, type Media, type Section, type SectionKind } from '@plataforma/core';
import { Image } from 'expo-image';
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { Platform, Alert, View } from 'react-native';
import { callFn, db, errorMessage, mediaUrl } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { pickAndUpload } from '@/lib/upload';
import { Button, Card, Chips, Empty, Field, Label, MultiChips, Notice, P, s, Screen, Title } from '@/ui';

interface Draft {
  id: string | null;
  name: string;
  kind: SectionKind;
  description: string;
  cover: Media | null;
  productIds: string[];
}

export default function Sections() {
  const { storeId, sections, products } = useMerchant();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!storeId) return null;
  const col = collection(db, 'stores', storeId, 'sections');

  const edit = (x: Section | null) =>
    setDraft({
      id: x?.id ?? null,
      name: x?.name ?? '',
      kind: x?.kind ?? 'Colección',
      description: x?.description ?? '',
      cover: x?.cover ?? null,
      productIds: x ? products.filter((p) => p.sectionIds.includes(x.id)).map((p) => p.id) : [],
    });

  async function save() {
    if (!draft || !storeId) return;
    if (draft.name.trim().length < 2) return setError('Poné un nombre para la sección.');
    setBusy(true);
    setError('');
    try {
      const data = { name: draft.name.trim(), kind: draft.kind, description: draft.description.trim(), cover: draft.cover, order: draft.id ? sections.find((x) => x.id === draft.id)?.order ?? 0 : sections.length };
      const id = draft.id ?? (await addDoc(col, data)).id;
      if (draft.id) await updateDoc(doc(col, id), data);
      // Las prendas que entran o salen de la sección se guardan con saveProduct (cuida el stock).
      for (const p of products) {
        const has = p.sectionIds.includes(id);
        const want = draft.productIds.includes(p.id);
        if (has === want) continue;
        const { id: productId, storeId: _s, createdAt: _c, updatedAt: _u, variants, ...rest } = p;
        await callFn('saveProduct', {
          storeId,
          productId,
          product: { ...rest, variants: variants.map(({ reserved: _r, ...v }) => v), sectionIds: want ? [...p.sectionIds, id] : p.sectionIds.filter((x) => x !== id) },
        });
      }
      setDraft(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function remove(x: Section) {
    const go = async () => {
      try {
        await deleteDoc(doc(col, x.id));
      } catch (e) {
        setError(errorMessage(e));
      }
    };
    const msg = 'Las prendas no se borran; solo dejan de estar agrupadas.';
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Borrar la sección "${x.name}"?\n\n${msg}`)) void go();
    } else Alert.alert(`¿Borrar "${x.name}"?`, msg, [{ text: 'Volver', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: go }]);
  }

  async function move(i: number, d: number) {
    const list = [...sections];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    const b = writeBatch(db);
    list.forEach((x, k) => b.update(doc(col, x.id), { order: k }));
    await b.commit();
  }

  if (draft) {
    return (
      <Screen>
        <Card>
          <Title size={22}>{draft.id ? 'Editar sección' : 'Nueva sección'}</Title>
          <Field label="Nombre" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} placeholder="Ej.: Nueva temporada" />
          <View><Label>Tipo</Label><Chips options={SECTION_KINDS} value={draft.kind} onChange={(k) => setDraft({ ...draft, kind: k })} /></View>
          <Field label="Descripción (opcional)" value={draft.description} onChangeText={(t) => setDraft({ ...draft, description: t })} />
          <Label>Imagen (opcional; si no, se usa la foto de la primera prenda)</Label>
          {draft.cover?.type === 'image' && <Image source={{ uri: mediaUrl(draft.cover.path) }} style={{ height: 120, borderRadius: 12 }} contentFit="cover" />}
          <View style={s.row}>
            <Button
              title={draft.cover ? 'Cambiar imagen o video' : 'Subir imagen o video'}
              variant="ghost"
              small
              onPress={async () => {
                const r = await pickAndUpload(storeId, { multiple: false, allowVideo: true });
                if (r.media[0]) setDraft({ ...draft, cover: r.media[0] });
                if (r.errors[0]) setError(r.errors[0]);
              }}
            />
            {draft.cover && <Button title="Quitar" variant="danger" small onPress={() => setDraft({ ...draft, cover: null })} />}
          </View>
          <Label>Prendas en esta sección · {draft.productIds.length}</Label>
          {products.length ? (
            <MultiChips options={products.map((p) => p.id)} value={draft.productIds} onChange={(v) => setDraft({ ...draft, productIds: v })} labels={Object.fromEntries(products.map((p) => [p.id, p.name]))} />
          ) : (
            <P small muted>Todavía no cargaste prendas.</P>
          )}
        </Card>
        {error ? <Notice text={error} tone="bad" /> : null}
        <Button title="Guardar sección" onPress={save} loading={busy} />
        <Button title="Cancelar" variant="ghost" onPress={() => setDraft(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <P muted>Agrupá las prendas como quieras: por marca, color, colección, temporada o promoción. Se muestran en este orden en la tienda.</P>
      <Button title="+ Nueva sección" onPress={() => edit(null)} />
      {error ? <Notice text={error} tone="bad" /> : null}
      {sections.length ? (
        <Card>
          {sections.map((x, i) => {
            const n = products.filter((p) => p.sectionIds.includes(x.id)).length;
            return (
              <View key={x.id} style={[s.between, { flexWrap: 'wrap' }]}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <P style={{ fontFamily: 'Manrope_600SemiBold' }}>{x.name}</P>
                  <P small muted>{x.kind} · {n} {n === 1 ? 'prenda' : 'prendas'}</P>
                </View>
                <View style={s.row}>
                  <Button title="↑" variant="ghost" small onPress={() => move(i, -1)} disabled={i === 0} />
                  <Button title="↓" variant="ghost" small onPress={() => move(i, 1)} disabled={i === sections.length - 1} />
                  <Button title="Editar" variant="ghost" small onPress={() => edit(x)} />
                  <Button title="Borrar" variant="danger" small onPress={() => remove(x)} />
                </View>
              </View>
            );
          })}
        </Card>
      ) : (
        <Empty title="Todavía no hay secciones" text='Por ejemplo: "Nueva temporada", "Marca Alma", "Todo en negro".' />
      )}
    </Screen>
  );
}
