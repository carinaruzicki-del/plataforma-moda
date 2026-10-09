import { colors } from '@plataforma/core';
import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useMerchant } from '@/lib/merchant';
import { font } from '@/ui';

const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;

export default function TabsLayout() {
  const { user, orders } = useMerchant();
  if (user === null) return <Redirect href="/login" />;
  const pending = orders.filter((o) => o.status === 'pagado').length;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: font.display, fontSize: 22, color: colors.ink },
        tabBarActiveTintColor: colors.plum,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="resumen" options={{ title: 'Resumen', tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="prendas" options={{ title: 'Prendas', tabBarIcon: icon('◫') }} />
      <Tabs.Screen name="pedidos" options={{ title: 'Pedidos', tabBarIcon: icon('▣'), tabBarBadge: pending || undefined, tabBarBadgeStyle: { backgroundColor: colors.plum } }} />
      <Tabs.Screen name="tienda" options={{ title: 'Mi tienda', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
