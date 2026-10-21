import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBar, type MainTab } from '../src/components/BottomTabBar';
import { CellarScreen } from '../src/features/cellar/CellarScreen';
import { colors, fonts } from '../src/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<MainTab>('cellar');
  const openRecord = () => router.push('/record');
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
    <View style={styles.main}>{tab === 'cellar' ? <CellarScreen items={[]} onRecord={openRecord} /> : <View style={styles.notice}><Text style={styles.title}>내 취향</Text><Text style={styles.body}>한 잔의 느낌이 쌓이면 여기서 함께 살펴봐요.</Text><Text style={styles.body}>취향 분석은 아직 연결 중이에요.</Text></View>}</View>
    <BottomTabBar selected={tab} onSelect={setTab} onRecord={openRecord} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, main: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }, notice: { padding: 24, gap: 16 }, title: { fontFamily: fonts.bold, fontSize: 28, color: colors.text }, body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.muted } });
