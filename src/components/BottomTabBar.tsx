import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
import { Icon } from './Icon';
export type MainTab = 'cellar' | 'taste';
export function BottomTabBar({ selected, onSelect, onRecord }: { selected: MainTab; onSelect: (tab: MainTab) => void; onRecord: () => void }) {
  const inset = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(inset.bottom, 12) }]}>
    {(['cellar', 'record', 'taste'] as const).map(tab => tab === 'record'
      ? <Pressable key={tab} accessibilityRole="button" accessibilityLabel="한 잔 기록하기" onPress={onRecord} style={({ pressed }) => [styles.record, pressed && { opacity: 0.75 }]}><Icon name="plus" size={28} color={colors.surface} /></Pressable>
      : <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: selected === tab }} onPress={() => onSelect(tab)} style={styles.tab}>
        <Icon name={tab === 'cellar' ? 'shelf' : 'heart'} color={selected === tab ? colors.primary : colors.muted} />
        <Text style={[styles.label, { color: selected === tab ? colors.primary : colors.muted }]}>{tab === 'cellar' ? '나의 술장' : '내 취향'}</Text>
      </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 10, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { minWidth: 92, minHeight: 60, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 1 },
  label: { fontSize: 11, lineHeight: 18, fontFamily: fonts.medium, textAlign: 'center' },
  record: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
