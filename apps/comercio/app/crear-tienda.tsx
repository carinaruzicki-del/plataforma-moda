import { suggestSubdomain, subdomainSchema } from '@plataforma/core';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth, callFn, errorMessage, storeLink } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Field, Notice, P, Screen, Title } from '@/ui';

export default function CreateStore() {
  const { user, setStoreId } = useMerchant();
  const [name, setName] = useState('');
  const [sub, setSub] = useState('');
  const [touchedSub, setTouchedSub] = useState(false);
  const [email, setEmail] = useState(user?.email ?? '');
  const [check, setCheck] = useState<{ ok: boolean; msg: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!touchedSub) setSub(suggestSubdomain(name));
  }, [name, touchedSub]);

  // Valida la dirección mientras se escribe.
  useEffect(() => {
    setCheck(null);
    const local = subdomainSchema.safeParse(sub);
    if (!sub) return;
    if (!local.success) return setCheck({ ok: false, msg: local.error.issues[0]?.message ?? 'Dirección inválida.' });
    const t = setTimeout(async () => {
      try {
        const r = await callFn<unknown, { available: boolean; message: string | null }>('checkSubdomain', { subdomain: sub });
        setCheck({ ok: r.available, msg: r.message });
      } catch {
        setCheck(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [sub]);

  async function create() {
    setBusy(true);
    setError('');
    try {
      const r = await callFn<unknown, { storeId: string }>('createStore', { name, subdomain: sub, email });
      setStoreId(r.storeId);
      router.replace('/resumen');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Tu tienda en minutos</Title>
      <P muted>Elegí el nombre y la dirección. Después cargás tus prendas y conectás Mercado Pago para cobrar.</P>
      <Card>
        <Field label="Nombre de la tienda" value={name} onChangeText={setName} placeholder="Ej.: Alma Indumentaria" />
        <Field
          label="Dirección"
          value={sub}
          onChangeText={(t) => { setTouchedSub(true); setSub(t.toLowerCase()); }}
          autoCapitalize="none"
          autoCorrect={false}
          error={check && !check.ok ? check.msg : null}
        />
        {sub ? <P small muted>Tu tienda va a estar en {storeLink(sub)}</P> : null}
        {check?.ok && <Notice text="¡Esa dirección está libre!" tone="ok" />}
        <Field label="Email de contacto de la tienda" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        {error ? <Notice text={error} tone="bad" /> : null}
        <Button title="Crear mi tienda" onPress={create} loading={busy} disabled={!name.trim() || !check?.ok || !email} />
      </Card>
      <Button title="Salir" variant="ghost" small onPress={() => signOut(auth)} />
    </Screen>
  );
}
