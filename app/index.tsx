import { useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebStatusSpace } from '../src/components/ScreenHeader';
import { BottomTabBar, type MainTab } from '../src/components/BottomTabBar';
import { TastePanel } from '../src/features/taste/TastePanel';
import { CellarScreen } from '../src/features/cellar/CellarScreen';
import { useCellar } from '../src/features/cellar/useCellar';
import type { Category } from '../src/features/cellar/model';
import { useAuth } from '../src/features/auth/AuthProvider';
import { colors, typography } from '../src/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { browse,tab:initialTab } = useLocalSearchParams<{ browse?: string;tab?:string }>();
  const auth = useAuth();
  const owner = auth.status === 'signed-in' ? auth.session.user.id : null;
  const [tab, setTab] = useState<MainTab>(initialTab==='taste'?'taste':'cellar');
  const [category, setCategory] = useState<Category | '전체'>('전체');
  const [query, setQuery] = useState('');
  const cellar = useCellar(owner, { query, category });
  if (auth.status === 'loading') return <View style={styles.loading}><ActivityIndicator accessibilityLabel="로그인 확인 중" color={colors.primary} /></View>;
  if (!owner && browse !== '1') return <Redirect href="/login" />;
  const openRecord = () => router.push(owner ? '/record' : '/login');
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
    <WebStatusSpace /><View style={styles.main}>
      {tab === 'cellar' ? <CellarScreen items={cellar.items} totalCount={cellar.total} loading={cellar.loading} error={cellar.error} onNext={cellar.next} onRetry={cellar.retry} category={category} onCategory={setCategory} query={query} onQuery={setQuery} onRecord={openRecord} onOpen={entryId => router.push({ pathname: '/detail', params: { entryId } })} /> : <TastePanel key={owner??'browse'} owner={owner} onRecord={openRecord} />}

    </View><BottomTabBar selected={tab} onSelect={setTab} onRecord={openRecord} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, main: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }, error: { padding: 24, gap: 16 }, body: { ...typography.body, color: colors.text } });
