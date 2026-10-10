import { designFeatures, resolveTheme } from '@plataforma/core';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { db, errorMessage, mediaUrl, storage, storeLink } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Field, Notice, P, s, Screen } from '@/ui';

export default function StoreData() {
  const { store, storeId } = useMerchant();
  const [f, setF] = useState({ name: '', tagline: '', email: '', phone: '', whatsapp: '', instagram: '' });
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  useEffect(() => {
    if (!store || loaded) return;
    setF({
      name: store.name,
      tagline: store.tagline ?? '',
      email: store.contact.email,
      phone: store.contact.phone ?? '',
      whatsapp: store.contact.whatsapp ?? '',
      instagram: store.contact.instagram ?? '',
    });
    setLogoPath(store.logoPath ?? null);
    setLoaded(true);
  }, [store, loaded]);

  if (!store || !storeId) return null;
  const accent = resolveTheme(store.theme, designFeatures(store.plan), store.accentColor).accent;
  const set = (k: keyof typeof f) => (t: string) => setF({ ...f, [k]: t });

  async function pickLogo() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (r.canceled || !r.assets[0]) return;
    try {
      const a = r.assets[0];
      const type = a.mimeType || 'image/jpeg';
      const path = `stores/${storeId}/logo/logo-${Date.now().toString(36)}.${type.split('/')[1]?.replace('jpeg', 'jpg')}`;
      await uploadBytes(ref(storage, path), await (await fetch(a.uri)).blob(), { contentType: type });
      setLogoPath(path);
    } catch (e) {
      setMsg({ text: errorMessage(e), tone: 'bad' });
    }
  }

  async function save() {
    if (f.name.trim().length < 2) return setMsg({ text: 'Poné el nombre de la tienda.', tone: 'bad' });
    setBusy(true);
    setMsg(null);
    try {
      await updateDoc(doc(db, 'stores', storeId!), {
        name: f.name.trim(),
        tagline: f.tagline.trim(),
        logoPath,
        contact: {
          email: f.email.trim(),
          ...(f.phone.trim() ? { phone: f.phone.trim() } : {}),
          ...(f.whatsapp.trim() ? { whatsapp: f.whatsapp.trim() } : {}),
          ...(f.instagram.trim() ? { instagram: f.instagram.trim().replace(/^@/, '') } : {}),
        },
        updatedAt: Date.now(),
      });
      setMsg({ text: 'Guardado.', tone: 'ok' });
    } catch (e) {
      setMsg({ text: errorMessage(e), tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <View style={[s.row, { alignItems: 'center' }]}>
          <Pressable onPress={pickLogo} style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            {logoPath ? <Image source={{ uri: mediaUrl(logoPath) }} style={{ width: 72, height: 72 }} /> : <P style={{ color: '#fff', fontSize: 28 }}>{f.name.charAt(0) || '✦'}</P>}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button title={logoPath ? 'Cambiar logo' : 'Subir logo'} variant="ghost" small onPress={pickLogo} />
            <P small muted>Dirección: {storeLink(store.subdomain)}</P>
          </View>
        </View>
        <Field label="Nombre" value={f.name} onChangeText={set('name')} />
        <Field label="Frase corta" value={f.tagline} onChangeText={set('tagline')} placeholder="Ej.: Moda para todos los días" />
        <Button title="Colores y diseño →" variant="ghost" small onPress={() => router.push('/configuracion/diseno')} />
      </Card>
      <Card>
        <View style={s.row}>
          <Field label="Email de contacto" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Teléfono" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Field label="WhatsApp" value={f.whatsapp} onChangeText={set('whatsapp')} keyboardType="phone-pad" />
          <Field label="Instagram" value={f.instagram} onChangeText={set('instagram')} autoCapitalize="none" placeholder="@tutienda" />
        </View>
      </Card>
      {msg && <Notice text={msg.text} tone={msg.tone} />}
      <Button title="Guardar" onPress={save} loading={busy} />
    </Screen>
  );
}
