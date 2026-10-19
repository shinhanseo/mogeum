import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBackendState } from '../src/lib/env';

// Bootstrap diagnostics only. Product screens are implemented in issue #2 onward.
export default function BootstrapScreen() {
  const [backend, setBackend] = useState(getBackendState);
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MOGEUM · DEVELOPMENT</Text>
    <Text style={styles.title}>모금</Text>
    <Text style={styles.subtitle}>가볍게 남기는 한 잔의 기억</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>개발 환경 확인</Text>
      <Text style={styles.body}>앱 초기 설정이 준비됐어요. 이 화면은 개발 상태를 확인하는 시작 화면이에요.</Text>
      <View style={styles.divider} />
      <Text style={styles.heading}>{backend.configured ? '서버 설정을 읽었어요' : '서버 연결 준비 중'}</Text>
      <Text style={styles.body}>{backend.configured ? '환경 변수 형식을 확인했어요. 인증과 실제 연결 확인은 서버 구현에서 진행해요.' : backend.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => setBackend(getBackendState())} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.buttonText}>설정 다시 확인</Text></Pressable>
    </View>
    <Text style={styles.caption}>사진 기록 · 나의 술장 · 내 취향
기능은 순서대로 연결하고 있어요.</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FAF7F2' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  eyebrow: { fontSize: 12, letterSpacing: 2, color: '#783F4B', textAlign: 'center' },
  title: { fontSize: 40, fontWeight: '700', color: '#783F4B', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#776B65', textAlign: 'center', marginBottom: 16 },
  card: { backgroundColor: '#FFFDFA', borderRadius: 24, padding: 24, gap: 16, borderWidth: 1, borderColor: '#E6DDD4' },
  heading: { fontSize: 18, fontWeight: '600', color: '#332D2B' },
  body: { fontSize: 15, lineHeight: 24, color: '#776B65' },
  divider: { height: 1, backgroundColor: '#E6DDD4' },
  button: { minHeight: 52, padding: 14, borderRadius: 16, backgroundColor: '#783F4B', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFDFA', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.8 },
  caption: { fontSize: 13, lineHeight: 22, color: '#776B65', textAlign: 'center' },
});
