import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebStatusSpace } from '../src/components/ScreenHeader';
import { BottomTabBar, type MainTab } from '../src/components/BottomTabBar';
import { Button } from '../src/components/Button';
import { TasteScreen } from '../src/features/taste/TasteScreen';
import { CellarScreen } from '../src/features/cellar/CellarScreen';
import type { Category, CellarItem } from '../src/features/cellar/model';
import { useAuth } from '../src/features/auth/AuthProvider';
import { getSupabase } from '../src/lib/supabase';
import { createRecordRepository } from '../src/features/records/repository';
import { colors, typography } from '../src/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { browse } = useLocalSearchParams<{ browse?: string }>();
  const auth = useAuth();
  const owner = auth.status === 'signed-in' ? auth.session.user.id : null;
  const [tab, setTab] = useState<MainTab>('cellar');
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
    void (async () => {
      const rows = [];
      // Load all pages for the initial cellar; each server request has a bounded page size.
      for (let from = 0; ; from += 100) {
        const page = await repository.listCellar(from, 100);
        if (!active) return;
        rows.push(...page);
        if (page.length < 100) break;
      }
      const kinds: Record<string, Category> = { whisky:'위스키', wine:'와인', beer:'맥주', traditional:'전통주', other:'기타' };
      const items = await Promise.all(rows.map(async row => ({
        id: String(row.id), name: row.display_name as string | null,
        category: kinds[row.category] ?? null, recordCount: Number(row.record_count),
        photoUri: row.photo_path ? await repository.photoUrl(String(row.photo_path)).catch(() => null) : null,
      })));
      if (active) setData({ owner, items });
    })().catch(() => { if (active) setError('술장을 불러오지 못했어요. 다시 시도해주세요.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner, reload]));
  if (auth.status === 'loading') return <View style={styles.loading}><ActivityIndicator accessibilityLabel="로그인 확인 중" color={colors.primary} /></View>;
  if (!owner && browse !== '1') return <Redirect href="/login" />;
  const openRecord = () => router.push(owner ? '/record' : '/login');
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
    <WebStatusSpace /><View style={styles.main}>
      {loading && !data ? <View style={styles.loading}><ActivityIndicator accessibilityLabel="술장 불러오는 중" color={colors.primary} /></View> : error ? <View style={styles.error}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Button label="다시 시도" onPress={() => setReload(value => value + 1)} /></View> : tab === 'cellar' ? <CellarScreen items={data?.owner === owner ? data.items : []} onRecord={openRecord} /> : <TasteScreen onRecord={openRecord} />}
    </View><BottomTabBar selected={tab} onSelect={setTab} onRecord={openRecord} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, main: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }, error: { padding: 24, gap: 16 }, body: { ...typography.body, color: colors.text } });
