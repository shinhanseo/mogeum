import { useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { Mogu } from '../src/components/Mogu';
import { WebStatusSpace } from '../src/components/ScreenHeader';
import { useAuth } from '../src/features/auth/AuthProvider';
import { signIn } from '../src/features/auth/oauth';
import { colors, fonts, typography } from '../src/theme/tokens';
import { openLegalDocument, type LegalDocument } from '../src/lib/legal-documents';

// 04 · 화면 정리본 / 4:3036. Geometry read directly from the original Figma frame.
export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<'apple' | 'kakao' | null>(null);
  const [error, setError] = useState('');
  if (auth.status === 'signed-in') return <Redirect href="/" />;
  async function login(provider: 'apple' | 'kakao') {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(provider); setError('');
    try { await signIn(provider); }
    catch (error) { setError(error instanceof Error && error.message === 'PROVIDER_NOT_CONFIGURED' ? '아직 로그인 서비스 설정 중이에요. 먼저 둘러볼 수 있어요.' : '로그인을 연결하지 못했어요. 잠시 후 다시 시도해주세요.'); }
    finally { busyRef.current = false; setBusy(null); }
  }
  async function openDocument(document: LegalDocument) {
    const url = document === 'privacy' ? process.env.EXPO_PUBLIC_PRIVACY_URL : process.env.EXPO_PUBLIC_TERMS_URL;
    const result = await openLegalDocument(url, Linking.openURL);
    if (result !== 'opened') setError(result === 'unconfigured' ? '아직 공개 문서를 준비하고 있어요. 외부 베타 전에 안내할게요.' : '문서를 열지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  return <SafeAreaView style={styles.page}>
    <WebStatusSpace />
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.canGoBack() ? router.back() : router.replace('/?browse=1')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <Text style={styles.logo}>모금.</Text><Text style={styles.tagline}>한 모금씩, 쌓이는 내 취향</Text>
        <View style={styles.art}><View style={styles.character}><Mogu /></View></View>
        <Text style={styles.title}>네 술장을 준비해둘게.</Text>
        <Text style={styles.description}>로그인하면 기록을 계정에 보관할 수 있어요.</Text>
        <View style={styles.actions}>
          <Button label="Apple로 계속하기" variant="apple" loading={busy === 'apple'} disabled={busy === 'kakao'} onPress={() => login('apple')} />
          <Button label="카카오로 계속하기" variant="kakao" loading={busy === 'kakao'} disabled={busy === 'apple'} onPress={() => login('kakao')} />
        </View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" onPress={() => router.replace('/?browse=1')} style={styles.browse}><Text style={styles.browseLabel}>먼저 둘러보기</Text></Pressable>
        <Text style={styles.terms}>계속하면 <Text accessibilityRole="link" accessibilityLabel="서비스 이용약관 열기" onPress={() => void openDocument('terms')}>서비스 이용약관</Text>과 <Text accessibilityRole="link" accessibilityLabel="개인정보 처리방침 열기" onPress={() => void openDocument('privacy')}>개인정보 처리방침</Text>에{`\n`}동의하게 됩니다.</Text>
        <Text style={styles.adult}>성인 사용자를 위한 술 취향 기록 서비스예요.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex:1, backgroundColor:colors.background }, scroll:{ flexGrow:1, alignItems:'center' }, content:{ width:'100%', maxWidth:600, paddingHorizontal:24, paddingBottom:60 },
  back:{ marginTop:15, marginLeft:-18, width:44, height:44, alignItems:'center', justifyContent:'center' }, backText:{ fontFamily:fonts.regular, fontSize:29, lineHeight:35, color:colors.text },
  logo:{ marginTop:12, fontFamily:fonts.bold, fontSize:42, lineHeight:50, textAlign:'center', color:colors.primary },
  tagline:{ marginTop:16, fontFamily:fonts.regular, fontSize:15, lineHeight:18, textAlign:'center', color:colors.muted },
  art:{ marginTop:28, height:148, alignItems:'center', justifyContent:'center' }, character:{ width:170, height:153, transform:[{ scale:0.918 }] },
  title:{ marginTop:20, fontFamily:fonts.bold, fontSize:25, lineHeight:30, color:colors.text, textAlign:'center' },
  description:{ marginTop:14, fontFamily:fonts.regular, fontSize:13, lineHeight:16, color:colors.muted, textAlign:'center' },
  actions:{ marginTop:58, gap:12 }, browse:{ marginTop:18, minHeight:44, alignItems:'center', justifyContent:'center' }, browseLabel:{ fontFamily:fonts.bold, fontSize:13, lineHeight:16, color:colors.primary },
  terms:{ marginTop:33, fontFamily:fonts.regular, fontSize:11, lineHeight:20, color:colors.muted, textAlign:'center' }, adult:{ marginTop:30, fontFamily:fonts.regular, fontSize:11, lineHeight:16, color:colors.muted, textAlign:'center' },
  error:{ ...typography.caption, color:colors.primary, textAlign:'center', marginTop:12 },
});
