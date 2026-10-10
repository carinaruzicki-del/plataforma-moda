import { designFeatures, formatCuit, isValidCuit, resolveTheme, TAX_STATUS_LABEL, type TaxStatus } from '@plataforma/core';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { db, errorMessage, mediaUrl, storage, storeLink } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Chips, Field, Label, Notice, P, s, Screen, Title } from '@/ui';

export default function StoreData() {
  const { store, storeId } = useMerchant();
  const [f, setF] = useState({ name: '', tagline: '', email: '', phone: '', whatsapp: '', instagram: '' });
  const [fiscal, setFiscal] = useState<{ legalName: string; cuit: string; address: string; taxStatus: TaxStatus | null }>({ legalName: '', cuit: '', address: '', taxStatus: null });
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
    if (store.fiscal) setFiscal({ ...store.fiscal, cuit: formatCuit(store.fiscal.cuit) });
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
    const anyFiscal = fiscal.legalName.trim() || fiscal.cuit.trim() || fiscal.address.trim() || fiscal.taxStatus;
    if (anyFiscal) {
      if (!fiscal.legalName.trim() || !fiscal.address.trim() || !fiscal.taxStatus) return setMsg({ text: 'Completá razón social, domicilio y condición frente al IVA.', tone: 'bad' });
      if (!isValidCuit(fiscal.cuit)) return setMsg({ text: 'Revisá el CUIT: tiene 11 números y el último es un dígito verificador.', tone: 'bad' });
    }
    setBusy(true);
    setMsg(null);
    try {
      await updateDoc(doc(db, 'stores', storeId!), {
        name: f.name.trim(),
        tagline: f.tagline.trim(),
        logoPath,
        ...(anyFiscal
          ? { fiscal: { legalName: fiscal.legalName.trim(), cuit: fiscal.cuit.replace(/\D/g, ''), address: fiscal.address.trim(), taxStatus: fiscal.taxStatus! } }
          : {}),
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
      <Card>
        <Title size={20}>Datos de la vendedora</Title>
        <P small muted>
          La ley pide que tus clientas vean quién les vende: se muestran en el pie de tu tienda. Si sos Responsable Inscripto,
          además mostramos el "Precio sin impuestos nacionales" de cada prenda.
        </P>
        <View style={s.row}>
          <Field label="Razón social o nombre y apellido" value={fiscal.legalName} onChangeText={(t) => setFiscal({ ...fiscal, legalName: t })} />
          <Field label="CUIT" value={fiscal.cuit} onChangeText={(t) => setFiscal({ ...fiscal, cuit: t })} keyboardType="numbers-and-punctuation" placeholder="20-12345678-6"
            error={fiscal.cuit && fiscal.cuit.replace(/\D/g, '').length === 11 && !isValidCuit(fiscal.cuit) ? 'Este CUIT no es válido.' : null} />
        </View>
        <Field label="Domicilio" value={fiscal.address} onChangeText={(t) => setFiscal({ ...fiscal, address: t })} placeholder="Calle, número, localidad, provincia" />
        <View>
          <Label>Condición frente al IVA</Label>
          <Chips options={Object.keys(TAX_STATUS_LABEL) as TaxStatus[]} value={fiscal.taxStatus} onChange={(v) => setFiscal({ ...fiscal, taxStatus: v })} labels={TAX_STATUS_LABEL} />
        </View>
      </Card>
      {msg && <Notice text={msg.text} tone={msg.tone} />}
      <Button title="Guardar" onPress={save} loading={busy} />
    </Screen>
  );
}
