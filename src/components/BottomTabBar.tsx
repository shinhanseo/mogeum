import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
import { Icon } from './Icon';
export type MainTab = 'cellar' | 'taste';
export function BottomTabBar({ selected, onSelect, onRecord }: { selected: MainTab; onSelect: (tab: MainTab) => void; onRecord: () => void }) {
  const inset = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(inset.bottom, 20) }]}><View style={styles.row}>
    {(['cellar', 'record', 'taste'] as const).map(tab => tab === 'record'
      ? <View key={tab} style={styles.column}><Pressable accessibilityRole="button" accessibilityLabel="한 잔 기록하기" onPress={onRecord} style={({ pressed }) => [styles.record, pressed && { opacity: 0.8 }]}><Icon name="plus" size={22} color={colors.surface} /></Pressable></View>
      : <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: selected === tab }} onPress={() => onSelect(tab)} style={styles.tab}>
        <Icon name={tab === 'cellar' ? 'shelf' : 'heart'} size={28} color={selected === tab ? colors.primary : colors.muted} />
        <Text style={[styles.label, { color: selected === tab ? colors.primary : colors.muted, fontFamily: selected === tab ? fonts.bold : fonts.regular }]}>{tab === 'cellar' ? '나의 술장' : '내 취향'}</Text>
      </Pressable>)}
  </View></View>;
}
const styles = StyleSheet.create({
  bar: { backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }, row: { height: 57, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 24 },
  column: { width: 56, alignItems: 'center' }, tab: { width: 88, minHeight: 57, paddingTop: 8, alignItems: 'center', gap: 2 },
  label: { fontSize: 10, lineHeight: 16, textAlign: 'center' }, record: { marginTop: -8, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
