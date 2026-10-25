import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type { Session } from "@supabase/supabase-js";
import { randomUUID } from "expo-crypto";
import { getBackendState } from "../../lib/env";
import { getSupabase } from "../../lib/supabase";
import {
  createProviderCaptureQueue,
  type CaptureProvider,
} from "./provider-capture";
const options = {
  keychainService: "mogeum-provider-capture-v1",
  keychainAccessible: 4,
};
// Optional loading keeps an older development client readable until its native rebuild is installed.
async function secure() {
  if (Platform.OS === "web" || !requireOptionalNativeModule("ExpoSecureStore"))
    throw Error("SECURE_STORE_UNAVAILABLE");
  return import("expo-secure-store");
}
function prefix() {
  const state = getBackendState();
  if (!state.configured) throw Error("NO_BACKEND");
  return `mogeum.provider.${new URL(state.config.url).hostname.replace(/[^a-z0-9]/gi, "_")}`;
}
const key = (owner: string, provider: CaptureProvider) =>
  `${prefix()}.${owner}.${provider}`;
const queue = createProviderCaptureQueue({
  read: async (owner, provider) =>
    (await secure()).getItemAsync(key(owner, provider), options),
  write: async (value) => {
    await (
      await secure()
    ).setItemAsync(
      key(value.owner, value.provider),
      JSON.stringify(value),
      options,
    );
  },
  remove: async (owner, provider) => {
    await (await secure()).deleteItemAsync(key(owner, provider), options);
  },
  active: async (owner) => {
    const client = getSupabase();
    if (!client) return false;
    const result = await client.auth.getSession();
    return !result.error && result.data.session?.user.id === owner;
  },
  send: async (value) => {
    const config = getBackendState(),
      client = getSupabase();
    if (!config.configured || !client) throw Error("NO_BACKEND");
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== value.owner)
      throw Error("ACCOUNT_CHANGED");
    const response = await fetch(
      `${config.config.url}/functions/v1/provider-credentials`,
      {
        method: "POST",
        headers: {
          apikey: config.config.publishableKey,
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: value.provider,
          refreshToken: value.refreshToken,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) throw Error("PROVIDER_CAPTURE_RETRY_REQUIRED");
    const body = await response.json();
    if (body.code !== "STORED")
      throw Error("INVALID_PROVIDER_CAPTURE_RESPONSE");
  },
});
export async function rememberProviderFlow(provider: CaptureProvider) {
  if (Platform.OS === "web") return;
  await (
    await secure()
  ).setItemAsync(
    `${prefix()}.flow`,
    JSON.stringify({ provider, operation: randomUUID() }),
    options,
  );
}
export async function clearProviderFlow() {
  if (Platform.OS === "web") return;
  await (await secure()).deleteItemAsync(`${prefix()}.flow`, options);
}
export async function captureExchangedSession(session: Session) {
  if (Platform.OS === "web" || !session.provider_refresh_token) return;
  const store = await secure(),
    flowKey = `${prefix()}.flow`,
    raw = await store.getItemAsync(flowKey, options);
  if (!raw) return;
  const flow = JSON.parse(raw);
  if (
    !["apple", "kakao"].includes(flow.provider) ||
    !session.user.identities?.some((i) => i.provider === flow.provider)
  )
    return;
  await queue.stage({
    version: 1,
    owner: session.user.id,
    provider: flow.provider,
    refreshToken: session.provider_refresh_token,
  });
  if ((await store.getItemAsync(flowKey, options)) === raw)
    await store.deleteItemAsync(flowKey, options);
  void queue.resume(session.user.id).catch(() => {});
}
export async function captureExistingSession(session: Session) {
  if (Platform.OS === "web") return;
  const providers =
    session.user.identities?.filter(
      (i) => i.provider === "apple" || i.provider === "kakao",
    ) ?? [];
  // A restored session with multiple linked providers cannot tell which issuer owns its opaque token.
  if (providers.length === 1 && session.provider_refresh_token)
    await queue.stage({
      version: 1,
      owner: session.user.id,
      provider: providers[0].provider as CaptureProvider,
      refreshToken: session.provider_refresh_token,
    });
  await queue.resume(session.user.id);
}
export async function resumeProviderCapture(owner: string) {
  if (Platform.OS === "web") return;
  await queue.resume(owner);
}
export async function clearProviderCapture(owner: string) {
  if (Platform.OS === "web" || !requireOptionalNativeModule("ExpoSecureStore"))
    return;
  await queue.clear(owner);
}
