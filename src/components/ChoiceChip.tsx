import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';
export function ChoiceChip({ label, selected = false, disabled = false, onPress }: { label: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.chip, selected && styles.selected, (disabled || pressed) && { opacity: disabled ? 0.45 : 0.75 }]}>
    <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.cabinet.top, justifyContent: 'center', alignItems: 'center' },
  selected: { backgroundColor: colors.primary }, label: { color: colors.muted, fontSize: 13, lineHeight: 20, fontFamily: fonts.medium, textAlign: 'center' }, selectedLabel: { color: colors.surface },
});
