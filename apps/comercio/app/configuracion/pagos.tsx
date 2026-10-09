import { DEFAULT_PLANS, type Plan } from '@plataforma/core';
import { doc, getDoc } from 'firebase/firestore';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { callFn, db, errorMessage } from '@/lib/firebase';
import { useMerchant } from '@/lib/merchant';
import { Button, Card, Notice, P, Screen, Title } from '@/ui';

export default function Payments() {
  const { store, storeId } = useMerchant();
  const params = useLocalSearchParams<{ mp?: string; msg?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);

  // Los planes vigentes los define la administración en la base; los de código son el respaldo.
  useEffect(() => {
    if (!store) return;
    getDoc(doc(db, 'plans', store.plan))
      .then((d) => setPlan((d.data() as Plan | undefined) ?? DEFAULT_PLANS[store.plan]))
      .catch(() => setPlan(DEFAULT_PLANS[store.plan]));
  }, [store?.plan]);

  if (!store || !storeId || !plan) return null;

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const { url } = await callFn<unknown, { url: string }>('mpConnectStart', { storeId });
      // Mercado Pago pide que la dueña entre a su cuenta y autorice. Al volver, la app se actualiza sola.
      if (Platform.OS === 'web') window.location.href = url;
      else await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await callFn('mpDisconnect', { storeId });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {params.mp === 'ok' && <Notice tone="ok" text={params.msg ?? 'Mercado Pago quedó conectado.'} />}
      {params.mp === 'error' && <Notice tone="bad" text={params.msg ?? 'No pudimos conectar Mercado Pago.'} />}
      <Card>
        <Title size={22}>{store.mpConnected ? 'Mercado Pago está conectado' : 'Conectá tu Mercado Pago'}</Title>
        <P muted>
          Las ventas se cobran en tu cuenta de Mercado Pago. Tus clientas pagan con tarjeta, débito, dinero en cuenta o efectivo, y la plata
          se acredita directo a vos.
        </P>
        <P muted>
          En tu plan ({plan.name}) la plataforma cobra {plan.commissionPct}% de cada venta de productos (no del envío). Mercado Pago descuenta
          aparte su comisión según el plazo de cobro que tengas configurado en tu cuenta.
        </P>
        {error ? <Notice tone="bad" text={error} /> : null}
        {store.mpConnected ? (
          <Button title="Desconectar Mercado Pago" variant="danger" onPress={disconnect} loading={busy} />
        ) : (
          <Button title="Conectar Mercado Pago" onPress={connect} loading={busy} />
        )}
      </Card>
      {!store.mpConnected && <P small muted>Mientras no esté conectado, tu tienda se ve pero no se puede comprar.</P>}
    </Screen>
  );
}
