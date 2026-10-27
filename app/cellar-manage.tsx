import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../src/features/auth/AuthProvider';
import { getSupabase } from '../src/lib/supabase';
import { Button } from '../src/components/Button';
import { CellarManageScreen } from '../src/features/cellar/CellarManageScreen';
import { cellarDeletionContext, deleteCellarEntry, type CellarDeletionContext } from '../src/features/cellar/deletion';
import { clearDraft } from '../src/features/tasting/persistence';
import { drainPhotoDeletions } from '../src/features/records/edit';
import { colors, typography } from '../src/theme/tokens';
export default function Manage() {
  const auth = useAuth(); const { entryId } = useLocalSearchParams<{ entryId: string }>();
  if (auth.status === 'loading') return <ActivityIndicator color={colors.primary} />;
  if (auth.status !== 'signed-in') return <Redirect href="/login" />;
  return <Connected key={`${auth.session.user.id}:${entryId}`} owner={auth.session.user.id} entryId={entryId} />;
}
function Connected({ owner, entryId }: { owner: string; entryId: string }) {
  const router = useRouter(); const [context, setContext] = useState<CellarDeletionContext | null>(null), [error, setError] = useState(false), [revision, setRevision] = useState(0); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { let active = true; const client = getSupabase(); if (client) void cellarDeletionContext(client, entryId).then(value => { if (active) setContext(value); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [entryId, revision]);
  const close = () => router.replace('/');
  const reload = () => { setContext(null); setError(false); setRevision(n => n + 1); };
  if (context) return <CellarManageScreen key={revision} context={context} onClose={close} onReload={reload} onRecords={id => { if (!id) return; router.push(context.deleted || context.count > 1 ? { pathname: '/detail', params: { entryId } } : { pathname: '/edit', params: { recordId: id } }); }} onDelete={async () => {
    const client = getSupabase(); if (!client) throw Error('UNAVAILABLE');
    const ids = await deleteCellarEntry(client, owner, context);
    // Server deletion is authoritative. Local cleanup failure must not turn a completed delete into a new delete request.
    void Promise.allSettled(ids.map(id => clearDraft(owner, id)));
    void drainPhotoDeletions(client, owner).catch(() => {});
    if (alive.current) close();
  }} />;
  return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: colors.background }}>{error ? <><Text accessibilityRole="alert" style={{ ...typography.body, color: colors.text }}>술 기록을 불러오지 못했어요.</Text><Button label="다시 불러오기" onPress={reload} /><Button label="술장으로 돌아가기" variant="text" onPress={close} /></> : <ActivityIndicator color={colors.primary} accessibilityLabel="술 관리 불러오는 중" />}</View>;
}
