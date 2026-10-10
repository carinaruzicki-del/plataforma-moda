import { formatPesos, PROVINCES, type ShippingZone } from '@plataforma/core';
import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { db, errorMessage } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Chip, Field, Label, MultiChips, Notice, P, s, Screen, Title } from '@/ui';

type ZoneDraft = { id: string; name: string; price: string; provinces: string[]; rest: boolean; prefixes: string; eta: string; freeFrom: string };

const money = (t: string) => Math.max(0, Number(t.replace(/\./g, '').replace(',', '.')) || 0);
const newId = () => `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
const draftOf = (z: ShippingZone): ZoneDraft => ({
  id: z.id,
  name: z.name,
  price: String(z.price),
  provinces: z.provinces ?? [],
  rest: !z.provinces?.length && !z.postalCodePrefixes?.length,
  prefixes: (z.postalCodePrefixes ?? []).join(', '),
  eta: z.eta ?? '',
  freeFrom: z.freeFrom ? String(z.freeFrom) : '',
});
/** Zonas típicas para arrancar: la dueña cambia los precios. */
const SUGGESTED: ZoneDraft[] = [
  { id: 'caba', name: 'CABA', price: '5000', provinces: ['CABA'], rest: false, prefixes: '', eta: '24 a 48 h hábiles', freeFrom: '' },
  { id: 'bsas', name: 'Provincia de Buenos Aires', price: '7500', provinces: ['Buenos Aires'], rest: false, prefixes: '', eta: '2 a 4 días hábiles', freeFrom: '' },
  { id: 'resto', name: 'Resto del país', price: '11000', provinces: [], rest: true, prefixes: '', eta: '3 a 7 días hábiles', freeFrom: '' },
];

export default function Delivery() {
  const { store, storeId } = useMerchant();
  const [pickupOn, setPickupOn] = useState(false);
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [shipOn, setShipOn] = useState(false);
  const [zones, setZones] = useState<ZoneDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  useEffect(() => {
    if (!store || loaded) return;
    setPickupOn(!!store.pickup?.enabled);
    setAddress(store.pickup?.address ?? '');
    setHours(store.pickup?.hours ?? '');
    setShipOn(!!store.flatShipping?.enabled);
    setZones((store.flatShipping?.zones ?? []).map(draftOf));
    setLoaded(true);
  }, [store, loaded]);

  if (!store || !storeId) return null;
  const upd = (i: number, patch: Partial<ZoneDraft>) => setZones(zones.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const covered = new Set(zones.filter((z) => !z.rest).flatMap((z) => z.provinces));
  const hasRest = zones.some((z) => z.rest);
  const uncovered = PROVINCES.filter((p) => !covered.has(p));

  async function save() {
    if (pickupOn && (!address.trim() || !hours.trim())) return setMsg({ text: 'Completá la dirección y el horario de retiro.', tone: 'bad' });
    const clean: ShippingZone[] = zones
      .filter((z) => z.name.trim())
      .map((z) => {
        const prefixes = z.prefixes.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
        const zone: ShippingZone = { id: z.id, name: z.name.trim(), price: money(z.price) };
        if (!z.rest && z.provinces.length) zone.provinces = z.provinces;
        if (!z.rest && prefixes.length) zone.postalCodePrefixes = prefixes;
        if (z.eta.trim()) zone.eta = z.eta.trim();
        if (money(z.freeFrom) > 0) zone.freeFrom = money(z.freeFrom);
        return zone;
      });
    if (shipOn && !clean.length) return setMsg({ text: 'Agregá al menos una zona de envío.', tone: 'bad' });
    const bad = zones.find((z) => z.name.trim() && !z.rest && !z.provinces.length && !z.prefixes.trim());
    if (shipOn && bad) return setMsg({ text: `Elegí a qué provincias llega la zona "${bad.name}", o marcala como resto del país.`, tone: 'bad' });
    if (shipOn && zones.filter((z) => z.rest).length > 1) return setMsg({ text: 'Solo puede haber una zona para el resto del país.', tone: 'bad' });
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
        {shipOn && (
          <>
            <P small muted>La clienta pone su código postal en el carrito y en el checkout, y se elige sola la zona y el precio. Se cobra todo junto en el pago.</P>
            {zones.length === 0 && <Button title="Usar zonas sugeridas (CABA, Buenos Aires, resto)" variant="outline" small onPress={() => setZones(SUGGESTED)} />}
            {zones.map((z, i) => (
              <View key={z.id} style={{ gap: 10, borderWidth: 1, borderColor: '#E7E1DB', borderRadius: 14, padding: 12 }}>
                <View style={[s.row, { alignItems: 'flex-end' }]}>
                  <Field label="Nombre de la zona" value={z.name} onChangeText={(t) => upd(i, { name: t })} placeholder="Ej.: CABA" />
                  <Field label="Precio ($)" value={z.price} onChangeText={(t) => upd(i, { price: t })} keyboardType="numeric" />
                  <Button title="✕" variant="danger" small onPress={() => setZones(zones.filter((_, j) => j !== i))} />
                </View>
                <View>
                  <Label>¿A dónde llega?</Label>
                  <View style={s.row}>
                    <Chip label="Provincias que elijo" on={!z.rest} onPress={() => upd(i, { rest: false })} />
                    <Chip label="Todo el resto del país" on={z.rest} onPress={() => upd(i, { rest: true })} />
                  </View>
                </View>
                {!z.rest && (
                  <>
                    <MultiChips options={PROVINCES} value={z.provinces} onChange={(v) => upd(i, { provinces: v })} />
                    <Field label="Códigos postales puntuales (opcional)" value={z.prefixes} onChangeText={(t) => upd(i, { prefixes: t })} autoCapitalize="characters"
                      placeholder="Ej.: B16, B17 (zona norte). Ganan sobre la provincia." />
                  </>
                )}
                <View style={s.row}>
                  <Field label="Demora (opcional)" value={z.eta} onChangeText={(t) => upd(i, { eta: t })} placeholder="Ej.: 2 a 4 días hábiles" />
                  <Field label="Envío gratis desde ($, opcional)" value={z.freeFrom} onChangeText={(t) => upd(i, { freeFrom: t })} keyboardType="numeric" placeholder="Ej.: 150000" />
                </View>
                {z.name ? (
                  <P small muted>
                    {z.name}: {formatPesos(money(z.price))}{z.eta ? ` · ${z.eta}` : ''}{money(z.freeFrom) ? ` · gratis desde ${formatPesos(money(z.freeFrom))}` : ''}
                  </P>
                ) : null}
              </View>
            ))}
            <Button title="+ Agregar zona" variant="ghost" small
              onPress={() => setZones([...zones, { id: newId(), name: '', price: '0', provinces: [], rest: false, prefixes: '', eta: '', freeFrom: '' }])} />
            {zones.length > 0 && !hasRest && uncovered.length > 0 && (
              <Notice text={`No enviás a ${uncovered.length === 1 ? uncovered[0] : `${uncovered.length} provincias`}. Si querés llegar a todo el país, agregá una zona "Todo el resto del país".`} />
            )}
          </>
        )}
      </Card>
      {msg && <Notice text={msg.text} tone={msg.tone} />}
      <Button title="Guardar" onPress={save} loading={busy} />
    </Screen>
  );
}
