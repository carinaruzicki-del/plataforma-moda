import { colors } from '@plataforma/core';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useMerchant } from '@/lib/merchant';

/** Decide a dónde ir: login, crear la tienda o el panel. */
export default function Index() {
  const { user, memberships } = useMerchant();
  if (user === undefined || (user && memberships === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!memberships?.length) return <Redirect href="/crear-tienda" />;
  return <Redirect href="/resumen" />;
}
