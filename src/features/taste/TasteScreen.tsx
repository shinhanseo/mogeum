import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Mogu } from '../../components/Mogu';
import { colors, fonts, typography } from '../../theme/tokens';
// Layout follows 04 / 28 (first discovery). No example tastes are inserted into user data.
export function TasteScreen({ onRecord }: { onRecord: () => void }) {
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <Text style={styles.heading}>내 취향</Text>
    <View style={styles.summary}><View style={styles.copy}><Text style={styles.eyebrow}>기록 0개</Text><Text style={styles.statement}>한 잔의 느낌부터{`\n`}모아볼까요?</Text></View><View style={styles.character}><View style={styles.scaled}><Mogu /></View></View></View>
    <Text style={styles.body}>아직 취향을 살펴볼 기록이 없어요.</Text>
    <View style={styles.actions}><Button label="첫 한 잔 남기기" onPress={onRecord} /><Button label="메뉴판에서 내 취향 찾기" variant="secondary" disabled onPress={() => {}} /><Text style={styles.caption}>취향 분석과 메뉴판 추천은 아직 연결 중이에요.</Text></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }, heading: { ...typography.heading, color: colors.text }, summary: { marginTop: 20, minHeight: 132, flexDirection: 'row', justifyContent: 'space-between' }, copy: { flex: 1 }, eyebrow: { fontSize: 12, lineHeight: 18, color: colors.primary, fontFamily: fonts.bold }, statement: { fontSize: 24, lineHeight: 36, color: colors.primary, fontFamily: fonts.bold, marginTop: 12 }, character: { width: 72, height: 72, marginTop: 8, overflow: 'hidden' }, scaled: { position: 'absolute', width: 170, height: 153, left: -49, top: -40, transform: [{ scale: 0.42 }] }, body: { ...typography.body, color: colors.muted, marginTop: 20 }, actions: { marginTop: 36, gap: 12 }, caption: { ...typography.caption, color: colors.muted, textAlign: 'center' },
});
