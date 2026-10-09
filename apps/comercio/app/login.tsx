import { colors } from '@plataforma/core';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { auth, errorMessage } from '@/lib/firebase';
import { Button, Card, Field, Notice, P, Screen, Title } from '@/ui';

export default function Login() {
  const [mode, setMode] = useState<'entrar' | 'crear'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'bad' | 'ok' } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'entrar') await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/');
    } catch (e) {
      setMsg({ text: errorMessage(e), tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!email.trim()) return setMsg({ text: 'Escribí tu email y tocá de nuevo "Olvidé mi contraseña".', tone: 'bad' });
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg({ text: 'Te mandamos un email para elegir una contraseña nueva.', tone: 'ok' });
    } catch (e) {
      setMsg({ text: errorMessage(e), tone: 'bad' });
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ height: 40 }} />
        <Title size={34}>{mode === 'entrar' ? 'Hola de nuevo' : 'Creá tu cuenta'}</Title>
        <P muted>{mode === 'entrar' ? 'Entrá para gestionar tu tienda.' : 'Con tu cuenta armás tu tienda online en minutos.'}</P>
        <Card>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} />
          {msg && <Notice text={msg.text} tone={msg.tone} />}
          <Button title={mode === 'entrar' ? 'Entrar' : 'Crear cuenta'} onPress={submit} loading={busy} disabled={!email || password.length < 6} />
          {mode === 'entrar' && <Button title="Olvidé mi contraseña" variant="ghost" small onPress={reset} />}
        </Card>
        <Button
          title={mode === 'entrar' ? '¿No tenés cuenta? Creala' : '¿Ya tenés cuenta? Entrá'}
          variant="ghost"
          onPress={() => { setMode(mode === 'entrar' ? 'crear' : 'entrar'); setMsg(null); }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
