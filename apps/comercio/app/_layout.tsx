import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { colors } from '@plataforma/core';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MerchantProvider } from '@/lib/merchant';
import { font } from '@/ui';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ Fraunces_500Medium, Fraunces_600SemiBold, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });
  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <MerchantProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.paper },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: font.display, fontSize: 20, color: colors.ink },
            headerTintColor: colors.plum,
            contentStyle: { backgroundColor: colors.paper },
            headerBackTitle: 'Volver',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="crear-tienda" options={{ title: 'Crear tu tienda' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="prenda/[id]" options={{ title: 'Prenda' }} />
          <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
          <Stack.Screen name="configuracion/portada" options={{ title: 'Portada y talles' }} />
          <Stack.Screen name="configuracion/secciones" options={{ title: 'Secciones' }} />
          <Stack.Screen name="configuracion/entregas" options={{ title: 'Entregas' }} />
          <Stack.Screen name="configuracion/pagos" options={{ title: 'Cobros' }} />
          <Stack.Screen name="configuracion/datos" options={{ title: 'Datos de la tienda' }} />
        </Stack>
      </MerchantProvider>
    </SafeAreaProvider>
  );
}
