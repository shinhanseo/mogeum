import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, Text } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createClient } from "@supabase/supabase-js";
import { probeNativeMenu } from "../../src/dev/menu-backend-probe";
import { colors, typography } from "../../src/theme/tokens";
export default function ManagedMenuProbe() {
  const { nonce } = useLocalSearchParams<{ nonce?: string }>();
  const started = useRef(false);
  const [phase, setPhase] = useState("준비 중");
  useEffect(() => {
    if (
      !__DEV__ ||
      Platform.OS === "web" ||
      !nonce ||
      !/^[a-f0-9-]{36}$/.test(nonce) ||
      started.current
    )
      return;
    started.current = true;
    const endpoint = `http://127.0.0.1:8767/run/${nonce}`;
    const passed: string[] = [];
    let active = true;
    void (async () => {
      let config: any;
      let status = "passed",
        result: unknown = null,
        current = "configuration";
      try {
        const response = await fetch(endpoint, {
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw Error("CONFIG_UNAVAILABLE");
        config = await response.json();
        if (
          config.url !== "https://vsckzjfgzdpzkzuumldf.supabase.co" ||
          !config.a?.token ||
          !config.b?.token
        )
          throw Error("INVALID_CONFIG");
        const client = (token: string) =>
          createClient(config.url, config.publicKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
        const a = client(config.a.token),
          b = client(config.b.token);
        for (const [sdk, identity] of [
          [a, config.a],
          [b, config.b],
        ] as const) {
          const verified = await sdk.auth.getUser(identity.token);
          if (
            verified.error ||
            verified.data.user?.id !== identity.owner ||
            verified.data.user.user_metadata.mogeum_test_run !== config.run ||
            verified.data.user.user_metadata.mogeum_test_fixture !==
              "native-managed-menu-v1"
          )
            throw Error("SYNTHETIC_ACCOUNT_REQUIRED");
        }
        result = await probeNativeMenu({
          client: a,
          foreign: b,
          owner: config.a.owner,
          recordId: config.recordId,
          revision: config.revision,
          phase: async (value) => {
            current = value;
            if (active) setPhase(value);
          },
          pass: async (value) => {
            passed.push(value);
          },
        });
      } catch {
        status = "failed";
      } finally {
        if (config?.run) {
          const saved = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              run: config.run,
              platform: Platform.OS,
              status,
              phase: current,
              passed,
              result,
            }),
            signal: AbortSignal.timeout(55000),
          }).catch(() => null);
          if (active)
            setPhase(
              `${status} · ${saved?.ok ? "임시 계정 정리 완료" : "정리 확인 필요"}`,
            );
        } else if (active) setPhase("설정 확인 실패");
      }
    })();
    return () => {
      active = false;
    };
  }, [nonce]);
  if (!__DEV__ || Platform.OS === "web") return <Redirect href="/" />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text style={{ ...typography.title, color: colors.text }}>
          관리형 네이티브 메뉴 검증
        </Text>
        <Text style={{ ...typography.body, color: colors.muted }}>
          합성 이미지·임시 계정 전용 · 기존 로그인 변경 없음
        </Text>
        <Text style={{ ...typography.body, color: colors.primary }}>
          {phase}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
