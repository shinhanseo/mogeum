import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';

type Props = { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: 'primary' | 'secondary' | 'text'; style?: StyleProp<ViewStyle> };
export function Button({ label, onPress, disabled, loading, variant = 'primary', style }: Props) {
  const blocked = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!blocked, busy: !!loading }} disabled={blocked} onPress={onPress}
    style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, blocked && styles.disabled, style]}>
    {loading ? <ActivityIndicator color={variant === 'primary' ? colors.surface : colors.primary} /> : <Text style={[styles.label, { color: variant === 'primary' ? colors.surface : colors.primary }]}>{label}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  base: { minHeight: 52, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.primary }, secondary: { backgroundColor: colors.selected }, text: { backgroundColor: 'transparent' },
  label: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 24, textAlign: 'center' }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.45 },
});
