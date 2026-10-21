import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebStatusSpace } from '../src/components/ScreenHeader';
import { BottomTabBar, type MainTab } from '../src/components/BottomTabBar';
import { TasteScreen } from '../src/features/taste/TasteScreen';
import { CellarScreen } from '../src/features/cellar/CellarScreen';
import { colors } from '../src/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<MainTab>('cellar');
  const openRecord = () => router.push('/record');
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
    <WebStatusSpace /><View style={styles.main}>{tab === 'cellar' ? <CellarScreen items={[]} onRecord={openRecord} /> : <TasteScreen onRecord={openRecord} />}</View>
    <BottomTabBar selected={tab} onSelect={setTab} onRecord={openRecord} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, main: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' } });
