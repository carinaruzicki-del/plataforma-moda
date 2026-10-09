import { formatPesos, type Store } from '@plataforma/core';
import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { db, errorMessage } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Field, Notice, P, s, Screen, Title } from '@/ui';

type Zone = NonNullable<Store['flatShipping']>['zones'][number];

export default function Delivery() {
  const { store, storeId } = useMerchant();
  const [pickupOn, setPickupOn] = useState(false);
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [shipOn, setShipOn] = useState(false);
  const [zones, setZones] = useState<Array<Omit<Zone, 'price'> & { price: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  useEffect(() => {
    if (!store || loaded) return;
    setPickupOn(!!store.pickup?.enabled);
    setAddress(store.pickup?.address ?? '');
    setHours(store.pickup?.hours ?? '');
    setShipOn(!!store.flatShipping?.enabled);
    setZones((store.flatShipping?.zones ?? []).map((z) => ({ ...z, price: String(z.price) })));
    setLoaded(true);
  }, [store, loaded]);

  if (!store || !storeId) return null;

  async function save() {
    if (pickupOn && (!address.trim() || !hours.trim())) return setMsg({ text: 'Completá la dirección y el horario de retiro.', tone: 'bad' });
    const clean = zones
      .filter((z) => z.name.trim())
      .map((z) => ({ id: z.id, name: z.name.trim(), price: Math.max(0, Number(z.price.replace(/\./g, '').replace(',', '.')) || 0) }));
    if (shipOn && !clean.length) return setMsg({ text: 'Agregá al menos una zona de envío.', tone: 'bad' });
    setBusy(true);
    setMsg(null);
    try {
      await updateDoc(doc(db, 'stores', storeId!), {
        pickup: { enabled: pickupOn, address: address.trim(), hours: hours.trim() },
        flatShipping: { enabled: shipOn, zones: clean },
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
        <View style={s.between}><Title size={20}>Retiro en el local</Title><Switch value={pickupOn} onValueChange={setPickupOn} trackColor={{ true: '#754653', false: '#E7E1DB' }} thumbColor="#fff" /></View>
        {pickupOn && (
          <>
            <Field label="Dirección" value={address} onChangeText={setAddress} placeholder="Ej.: Av. Corrientes 1234, CABA" />
            <Field label="Horario" value={hours} onChangeText={setHours} placeholder="Ej.: Lunes a sábados de 10 a 19" />
          </>
        )}
      </Card>
      <Card>
        <View style={s.between}><Title size={20}>Envío con tarifa propia</Title><Switch value={shipOn} onValueChange={setShipOn} trackColor={{ true: '#754653', false: '#E7E1DB' }} thumbColor="#fff" /></View>
        <P small muted>Definí precios por zona. Vos despachás y cargás el número de seguimiento en cada pedido. Los correos integrados llegan en la próxima etapa.</P>
        {shipOn && (
          <>
            {zones.map((z, i) => (
              <View key={z.id} style={[s.row, { alignItems: 'flex-end' }]}>
                <Field label="Zona" value={z.name} onChangeText={(t) => setZones(zones.map((x, j) => (j === i ? { ...x, name: t } : x)))} placeholder="Ej.: CABA" />
                <Field label="Precio ($)" value={z.price} onChangeText={(t) => setZones(zones.map((x, j) => (j === i ? { ...x, price: t } : x)))} keyboardType="numeric" />
                <Button title="✕" variant="danger" small onPress={() => setZones(zones.filter((_, j) => j !== i))} />
              </View>
            ))}
            <Button title="+ Agregar zona" variant="ghost" small onPress={() => setZones([...zones, { id: `z${Date.now().toString(36)}`, name: '', price: '0' }])} />
            {zones.some((z) => z.name) && <P small muted>Ejemplo en el checkout: {zones.filter((z) => z.name).map((z) => `${z.name} ${formatPesos(Number(z.price) || 0)}`).join(' · ')}</P>}
          </>
        )}
      </Card>
      {msg && <Notice text={msg.text} tone={msg.tone} />}
      <Button title="Guardar" onPress={save} loading={busy} />
    </Screen>
  );
}
