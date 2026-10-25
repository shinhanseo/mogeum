import { useRef, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { ScrollView, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { Button } from "../../src/components/Button";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { signIn } from "../../src/features/auth/oauth";
import { getBackendState } from "../../src/lib/env";
import { getSupabase } from "../../src/lib/supabase";
import { colors, space, typography } from "../../src/theme/tokens";
export default function AuthCheck() {
  const router = useRouter(),
    lock = useRef(false);
  const [busy, setBusy] = useState<"apple" | "kakao" | null>(null),
    [message, setMessage] = useState(
      "실제 로그인 연결을 확인하는 개발 전용 화면이에요. 기록은 만들거나 삭제하지 않아요.",
    );
  const config = getBackendState();
  if (
    !__DEV__ ||
    !config.configured ||
    config.config.url !== "https://vsckzjfgzdpzkzuumldf.supabase.co"
  )
    return <Redirect href="/" />;
  async function login(provider: "apple" | "kakao") {
    if (lock.current) return;
    lock.current = true;
    setBusy(provider);
    setMessage("로그인 창에서 직접 인증과 동의를 완료해주세요.");
    try {
      const client = getSupabase();
      if (!client) throw Error("NO_BACKEND");
      const before = (await client.auth.getSession()).data.session
        ?.access_token;
      await signIn(provider);
      const { data, error } = await client.auth.getSession();
      const session = data.session;
      if (error || !session || session.access_token === before) {
        setMessage("로그인을 완료하지 않았어요. 기존 로그인은 유지돼요.");
        return;
      }
      const verified = await client.auth.getUser();
      if (
        verified.error ||
        !verified.data.user.identities?.some(
          (identity) => identity.provider === provider,
        )
      )
        throw Error("PROVIDER_NOT_VERIFIED");
      const proof = {
        checkedAt: new Date().toISOString(),
        provider,
        managedDevelopment: true,
        authVerified: true,
        newSession: true,
        providerAccessTokenAvailable: !!session.provider_token,
        providerRefreshTokenAvailable: !!session.provider_refresh_token,
      };
      if (FileSystem.documentDirectory)
        await FileSystem.writeAsStringAsync(
          `${FileSystem.documentDirectory}mogeum-auth-proof.json`,
          JSON.stringify(proof),
        );
      setMessage(
        `${provider === "apple" ? "Apple" : "카카오"} 로그인이 확인됐어요. 술장으로 돌아가면 돼요.`,
      );
    } catch {
      setMessage("로그인 연결을 확인하지 못했어요. 다시 시도해주세요.");
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  return (
    <SafeAreaView style={s.page}>
      <ScreenHeader
        title="로그인 연결 확인"
        onBack={() => router.replace("/")}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.caption}>개발 검증 · 기록 변경 없음</Text>
        <Text style={s.title}>{"로그인 연결을\n확인할게요."}</Text>
        <Text style={s.body}>{message}</Text>
        <Button
          label="Apple 로그인 확인"
          variant="apple"
          loading={busy === "apple"}
          disabled={busy === "kakao"}
          onPress={() => void login("apple")}
        />
        <Button
          label="카카오 로그인 확인"
          variant="kakao"
          loading={busy === "kakao"}
          disabled={busy === "apple"}
          onPress={() => void login("kakao")}
        />
        <Button
          label="술장으로 돌아가기"
          variant="text"
          disabled={!!busy}
          onPress={() => router.replace("/")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, gap: space.lg },
  title: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
});
