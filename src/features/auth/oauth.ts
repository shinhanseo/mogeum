import {
  rememberProviderFlow,
  clearProviderFlow,
} from "./provider-capture-device";
import { oauthOptions } from "./options";
import { exchangeOAuthCode } from "./exchange";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { getBackendState } from "../../lib/env";
import { getSupabase } from "../../lib/supabase";
WebBrowser.maybeCompleteAuthSession();
export async function signIn(provider: "apple" | "kakao") {
  const client = getSupabase();
  if (!client) throw new Error("서버 설정을 확인해주세요.");
  const config = getBackendState();
  if (!config.configured) throw new Error("서버 설정을 확인해주세요.");
  const response = await fetch(`${config.config.url}/auth/v1/settings`, {
    headers: { apikey: config.config.publishableKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("로그인 설정을 확인하지 못했어요.");
  const settings = (await response.json()) as {
    external?: Record<string, boolean>;
  };
  if (!settings.external?.[provider])
    throw new Error("PROVIDER_NOT_CONFIGURED");
  const redirectTo =
    Platform.OS === "web"
      ? `${window.location.origin}/auth/callback`
      : Linking.createURL("auth/callback");
  if (Platform.OS !== "web") await rememberProviderFlow(provider);
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: oauthOptions(provider, redirectTo),
  });
  if (error || !data.url)
    throw new Error(
      "로그인 연결을 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  if (Platform.OS === "web") {
    window.location.assign(data.url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") {
    await clearProviderFlow();
    return;
  }
  const url = new URL(result.url);
  const expected = new URL(redirectTo);
  if (
    url.protocol !== expected.protocol ||
    url.host !== expected.host ||
    url.pathname !== expected.pathname ||
    url.searchParams.has("error")
  )
    throw new Error("로그인을 완료하지 못했어요.");
  const code = url.searchParams.get("code");
  if (!code) throw new Error("로그인 응답을 확인하지 못했어요.");
  await exchangeOAuthCode(client, code);
}
