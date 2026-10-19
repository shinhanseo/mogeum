export type BackendConfig = { url: string; publishableKey: string };
export type BackendState = { configured: true; config: BackendConfig } | { configured: false; message: string };

// Explicit access is required for Expo's compile-time environment replacement.
export function readBackendConfig(url?: string, key?: string): BackendState {
  if (!url?.trim() || !key?.trim() || url.includes('YOUR_PROJECT') || key.includes('YOUR_')) {
    return { configured: false, message: '아직 서버가 연결되지 않았어요. 개발 환경에 Supabase URL과 공개 키를 설정해 주세요.' };
  }
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Invalid endpoint');
    if (key.startsWith('sb_secret_') || key.split('.').length === 3) {
      return { configured: false, message: 'Supabase Publishable key를 사용해 주세요. 서버 비밀 키와 기존 JWT 키는 앱 설정에 넣지 않습니다.' };
    }
    return { configured: true, config: { url: parsed.origin, publishableKey: key.trim() } };
  } catch {
    return { configured: false, message: '서버 URL을 확인해 주세요. HTTPS 주소 또는 로컬 개발 주소가 필요해요.' };
  }
}
export function getBackendState(): BackendState {
  return readBackendConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
