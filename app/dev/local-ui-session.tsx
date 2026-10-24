import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { getBackendState } from "../../src/lib/env";
import { getSupabase } from "../../src/lib/supabase";
import { colors, typography } from "../../src/theme/tokens";
/** Explicit local-only synthetic identity for native UI E2E. No production login shortcut. */
export default function LocalUiSession() {
  const { runId, finish } = useLocalSearchParams<{
    runId?: string;
    finish?: string;
  }>();
  const router = useRouter(),
    started = useRef(false);
  const [status, setStatus] = useState(
    "로컬 합성 계정 준비 중 · 운영 서버 사용 안 함",
  );
  const config = getBackendState();
  const allowed =
    __DEV__ &&
    Platform.OS !== "web" &&
    config.configured &&
    config.config.url === "http://127.0.0.1:54321";
  useEffect(() => {
    if (
      !allowed ||
      started.current ||
      !runId ||
      !/^[a-z0-9_-]{1,60}$/i.test(runId)
    )
      return;
    started.current = true;
    async function start() {
      const client = getSupabase();
      if (!client) throw new Error("LOCAL_CONFIG_REQUIRED");
      const file = `${FileSystem.documentDirectory}native-record-probe-private-${runId}.json`;
      if (finish === "1") {
        const manifest = JSON.parse(await FileSystem.readAsStringAsync(file));
        const verified = await client.auth.getUser();
        if (
          verified.error ||
          manifest.runId !== runId ||
          manifest.userIds?.length !== 1 ||
          verified.data.user?.id !== manifest.userIds[0] ||
          verified.data.user.user_metadata.mogeum_native_probe !== runId ||
          !/^native-[0-9a-f-]+@example\.test$/i.test(
            verified.data.user.email ?? "",
          )
        )
          throw new Error("SYNTHETIC_OWNER_REQUIRED");
        const signedOut = await client.auth.signOut();
        if (signedOut.error) throw new Error("SIGNOUT_FAILED");
        router.replace("/login");
        return;
      }
      if ((await FileSystem.getInfoAsync(file)).exists)
        throw new Error("USE_NEW_RUN_ID");
      const current = await client.auth.getSession();
      if (current.error || current.data.session)
        throw new Error("EXISTING_SESSION_REFUSED");
      const result = await client.auth.signUp({
        email: `native-${randomUUID()}@example.test`,
        password: `${randomUUID()}Aa1!`,
        options: { data: { mogeum_native_probe: runId } },
      });
      if (!result.data.user || result.error || !result.data.session)
        throw new Error("LOCAL_AUTH_FAILED");
      await FileSystem.writeAsStringAsync(
        file,
        JSON.stringify({ runId, userIds: [result.data.user.id] }),
      );
      router.replace("/discovery");
    }
    void start().catch(() =>
      setStatus(
        "로컬 검증을 시작하지 못했어요. 기존 계정이나 실행 ID는 덮지 않아요.",
      ),
    );
  }, [allowed, router, runId, finish]);
  if (!allowed) return <Redirect href="/" />;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text style={{ ...typography.body, color: colors.text }}>{status}</Text>
    </View>
  );
}
