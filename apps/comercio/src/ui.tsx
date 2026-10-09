import { colors } from '@plataforma/core';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const font = {
  display: 'Fraunces_500Medium',
  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = <View style={[{ gap: 16, width: '100%', maxWidth: 860, alignSelf: 'center' }, padded && { padding: 16 }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Title({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return <Text style={{ fontFamily: font.display, fontSize: size, color: colors.ink, lineHeight: size * 1.15 }}>{children}</Text>;
}

export function P({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: TextStyle }) {
  return (
    <Text style={[{ fontFamily: font.body, fontSize: small ? 13 : 15, lineHeight: small ? 18 : 21, color: muted ? colors.muted : colors.ink }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted, marginBottom: 6 }}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  const bg = { primary: colors.plum, ghost: colors.surface, outline: colors.surface, danger: colors.surface }[variant];
  const fg = { primary: '#fff', ghost: colors.ink, outline: colors.plum, danger: colors.danger }[variant];
  const border = { primary: colors.plum, ghost: colors.line, outline: colors.plum, danger: '#E3C3C0' }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && { paddingVertical: 8, paddingHorizontal: 14 },
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontFamily: font.semibold, fontSize: small ? 13 : 15 }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ flexGrow: 1, minWidth: 160 }}>
      <Label>{label}</Label>
      <TextInput placeholderTextColor="#A39C96" {...props} style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]} />
      {error ? <Text style={{ color: colors.danger, fontFamily: font.body, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[s.chip, on && { backgroundColor: colors.plumSoft, borderColor: '#D5BDC4' }]}
    >
      <Text style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 13, color: on ? colors.plum : '#5E5751' }}>{label}</Text>
    </Pressable>
  );
}

export function Chips<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T | null | undefined; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <View style={s.row}>
      {options.map((o) => <Chip key={o} label={labels?.[o] ?? o} on={value === o} onPress={() => onChange(o)} />)}
    </View>
  );
}

export function MultiChips<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: readonly T[]; onChange: (v: T[]) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <View style={s.row}>
      {options.map((o) => (
        <Chip
          key={o}
          label={labels?.[o] ?? o}
          on={value.includes(o)}
          onPress={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}
        />
      ))}
    </View>
  );
}

const PILL = {
  ok: [colors.sageSoft, colors.sageInk],
  low: [colors.warnSoft, colors.warnInk],
  out: [colors.sand, colors.muted],
  accent: [colors.plumSoft, colors.plum],
  bad: [colors.dangerSoft, colors.danger],
} as const;

export function Pill({ label, tone = 'accent' }: { label: string; tone?: keyof typeof PILL }) {
  const [bg, fg] = PILL[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontFamily: font.semibold, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontFamily: font.display, fontSize: 20, color: colors.ink, textAlign: 'center' }}>{title}</Text>
      {text ? <P muted style={{ textAlign: 'center' }}>{text}</P> : null}
      {action}
    </View>
  );
}

export function Notice({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'ok' | 'bad' }) {
  const bg = tone === 'ok' ? colors.sageSoft : tone === 'bad' ? colors.dangerSoft : colors.warnSoft;
  const fg = tone === 'ok' ? colors.sageInk : tone === 'bad' ? colors.danger : colors.warnInk;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 14, padding: 12 }}>
      <Text style={{ color: fg, fontFamily: font.medium, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  btn: { borderRadius: 999, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, fontFamily: font.body, fontSize: 15, color: colors.ink },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#D9D0C7', borderRadius: 18, padding: 24, alignItems: 'center', gap: 10, backgroundColor: '#FBF9F6' },
});
