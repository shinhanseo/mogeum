import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { createClient } from "@supabase/supabase-js";
import { getBackendState } from "../../src/lib/env";
import { ensureNativeAuthCrypto } from "../../src/lib/native-auth-crypto";
import { colors, typography } from "../../src/theme/tokens";

/** Native S256 verification only. No account, browser, auth exchange or private output. */
export default function AuthCryptoProbe() {
  const { runId } = useLocalSearchParams<{ runId?: string }>();
  const started = useRef(false);
  const stage = useRef("prepare");
  const [status, setStatus] = useState("네이티브 S256 확인 중");
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
      !/^[a-z0-9_-]{1,60}$/i.test(runId) ||
      !config.configured
    )
      return;
    started.current = true;
    const local = config.config;
    async function verify() {
      stage.current = "native-bridge";
      ensureNativeAuthCrypto();
      stage.current = "rfc-vector";
      const encode = (bytes: ArrayBuffer) =>
        btoa(String.fromCharCode(...new Uint8Array(bytes)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const vector = encode(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      );
      if (vector !== "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
        throw new Error("VECTOR_FAILED");
      stage.current = "sdk-client";
      const memory = new Map<string, string>();
      const sdk = createClient(local.url, local.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: "pkce",
          storageKey: "mogeum-native-pkce-probe",
          storage: {
            getItem: (key) => memory.get(key) ?? null,
            setItem: (key, value) => {
              memory.set(key, value);
            },
            removeItem: (key) => {
              memory.delete(key);
            },
          },
        },
      });
      try {
        stage.current = "sdk-url";
        const result = await sdk.auth.signInWithOAuth({
          provider: "apple",
          options: {
            skipBrowserRedirect: true,
            redirectTo: "mogeum-dev://auth/callback",
          },
        });
        if (result.error || !result.data.url) throw new Error("SDK_URL_FAILED");
        const url = new URL(result.data.url);
        stage.current = "stored-verifier";
        const stored = memory.get("mogeum-native-pkce-probe-code-verifier");
        if (!stored) throw new Error("VERIFIER_MISSING");
        const sdkVerifier = JSON.parse(stored);
        if (typeof sdkVerifier !== "string" || sdkVerifier.length < 43)
          throw new Error("VERIFIER_INVALID");
        stage.current = "sdk-challenge";
        const expected = encode(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(sdkVerifier),
          ),
        );
        if (
          url.searchParams.get("code_challenge_method") !== "s256" ||
          url.searchParams.get("code_challenge") !== expected ||
          expected === sdkVerifier
        )
          throw new Error("SDK_S256_FAILED");
        const report = {
          synthetic: true,
          platform: Platform.OS,
          runId,
          rfc7636Vector: true,
          sdkMethod: "s256",
          sdkChallengeMatchesDigest: true,
          challengeLength: expected.length,
          accountCreated: false,
          browserOpened: false,
          checkedAt: new Date().toISOString(),
        };
        stage.current = "write-report";
        await FileSystem.writeAsStringAsync(
          `${FileSystem.documentDirectory}native-auth-crypto-${runId}.json`,
          JSON.stringify(report, null, 2),
        );
        setStatus("네이티브 S256 · RFC7636 · SDK challenge 확인 완료");
      } finally {
        memory.clear();
        sdk.auth.stopAutoRefresh();
      }
    }
    void verify().catch(() =>
      setStatus(`S256 검증 실패 · ${stage.current} · 비밀값은 출력하지 않아요`),
    );
  }, [allowed, runId, config]);
  if (!allowed) return <Redirect href="/" />;
  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ ...typography.body, color: colors.text }}>{status}</Text>
    </View>
  );
}
