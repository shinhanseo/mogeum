import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebStatusSpace } from '../src/components/ScreenHeader';
import { BottomTabBar, type MainTab } from '../src/components/BottomTabBar';
import { Button } from '../src/components/Button';
import { TastePanel } from '../src/features/taste/TastePanel';
import { CellarScreen } from '../src/features/cellar/CellarScreen';
import { loadCellar } from '../src/features/cellar/load';
import type { CellarItem } from '../src/features/cellar/model';
import { useAuth } from '../src/features/auth/AuthProvider';
import { getSupabase } from '../src/lib/supabase';
import { drainPhotoDeletions } from '../src/features/records/edit';
import { createRecordRepository } from '../src/features/records/repository';
import { colors, typography } from '../src/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { browse,tab:initialTab } = useLocalSearchParams<{ browse?: string;tab?:string }>();
  const auth = useAuth();
  const owner = auth.status === 'signed-in' ? auth.session.user.id : null;
  const [tab, setTab] = useState<MainTab>(initialTab==='taste'?'taste':'cellar');
  const [data, setData] = useState<{ owner: string; items: CellarItem[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => {
    void reload;
    let active = true;
    setError('');
    const client = getSupabase();
    if (!owner || !client) { setData(null); setLoading(false); return; }
    setLoading(true);
    const repository = createRecordRepository(client);
    void drainPhotoDeletions(client,owner).catch(()=>{});
    void (async () => {
      const items = await loadCellar(owner, {
        page: (from, size) => repository.listCellar(from, size),
        photos: paths => repository.photoUrls(owner, paths),
        active: () => active,
      });
      if (active && items) setData({ owner, items });
    })().catch(() => { if (active) setError('술장을 불러오지 못했어요. 다시 시도해주세요.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner, reload]));
  if (auth.status === 'loading') return <View style={styles.loading}><ActivityIndicator accessibilityLabel="로그인 확인 중" color={colors.primary} /></View>;
  if (!owner && browse !== '1') return <Redirect href="/login" />;
  const openRecord = () => router.push(owner ? '/record' : '/login');
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
    <WebStatusSpace /><View style={styles.main}>
      {loading && !data ? <View style={styles.loading}><ActivityIndicator accessibilityLabel="술장 불러오는 중" color={colors.primary} /></View> : error ? <View style={styles.error}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Button label="다시 시도" onPress={() => setReload(value => value + 1)} /></View> : tab === 'cellar' ? <CellarScreen items={data?.owner === owner ? data.items : []} onRecord={openRecord} onOpen={entryId => router.push({ pathname: '/detail', params: { entryId } })} /> : <TastePanel key={owner??'browse'} owner={owner} onRecord={openRecord} />}
    </View><BottomTabBar selected={tab} onSelect={setTab} onRecord={openRecord} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, main: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }, error: { padding: 24, gap: 16 }, body: { ...typography.body, color: colors.text } });
