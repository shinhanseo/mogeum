import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSupabase } from '../../src/lib/supabase';
import { Button } from '../../src/components/Button';
import { colors, typography } from '../../src/theme/tokens';
import { exchangeOAuthCode } from '../../src/features/auth/exchange';
export default function AuthCallback() {
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const client = getSupabase();
    if (!client || error || typeof code !== 'string') return;
    void exchangeOAuthCode(client, code).then(() => { if (active) router.replace('/'); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [code, error, router]);
  return <View style={{ flex:1, justifyContent:'center', padding:24, gap:16, backgroundColor:colors.background }}>{failed || error || typeof code !== 'string' || !getSupabase() ? <><Text style={{ ...typography.body, color:colors.text }}>로그인을 완료하지 못했어요. 다시 시도해주세요.</Text><Button label="로그인으로 돌아가기" onPress={() => router.replace('/login')} /></> : <ActivityIndicator accessibilityLabel="로그인 완료하는 중" color={colors.primary} />}</View>;
}
