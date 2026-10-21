import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, typography } from '../theme/tokens';
type Props = { label: string; selected?: boolean; disabled?: boolean; compact?: boolean; onPress: () => void; style?: StyleProp<ViewStyle> };
export function ChoiceChip({ label, selected = false, disabled = false, compact = false, onPress, style }: Props) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.chip, compact && styles.compact, selected && (compact ? styles.filterSelected : styles.selected), pressed && styles.pressed, disabled && styles.disabled, style]}>
    <Text style={[styles.label, compact && styles.compactLabel, selected && (compact ? styles.filterSelectedLabel : styles.selectedLabel)]}>{label}</Text>
    {selected && !compact && <Text style={styles.check}>✓</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  chip: { minHeight: 55, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  compact: { minHeight: 31, paddingHorizontal: 15, paddingVertical: 6, borderRadius: 15, borderWidth: 0, backgroundColor: colors.chip },
  selected: { backgroundColor: colors.selected, borderColor: colors.primary }, filterSelected: { backgroundColor: colors.primary },
  label: { color: colors.text, fontSize: 13, lineHeight: 20, fontFamily: fonts.regular, textAlign: 'center' }, compactLabel: { ...typography.filter, color: colors.muted },
  selectedLabel: { color: colors.primary, fontFamily: fonts.bold }, filterSelectedLabel: { color: colors.surface }, check: { position: 'absolute', right: 10, top: 5, fontSize: 10, fontFamily: fonts.bold, color: colors.primary },
  pressed: { opacity: 0.8 }, disabled: { opacity: 0.45 },
});
