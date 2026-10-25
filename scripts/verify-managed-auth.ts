/** Read-only OAuth setup verification for the explicitly approved Mogeum development project. No account/session is created. */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { oauthOptions } from "../src/features/auth/options";
async function main() {
  process.loadEnvFile(".env");
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (base !== "https://vsckzjfgzdpzkzuumldf.supabase.co" || !key)
    throw Error("Approved development project required");
  const response = await fetch(base + "/auth/v1/settings", {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  });
  const settings = await response.json();
  if (!response.ok || !settings.external?.apple || !settings.external?.kakao)
    throw Error("OAuth providers are not enabled");
  const results = [];
  for (const provider of ["apple", "kakao"] as const) {
    const client = createClient(base, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: oauthOptions(provider, "mogeum-dev://auth/callback"),
    });
    if (error || !data.url) throw Error("OAuth URL preparation failed");
    const result = await fetch(data.url, {
      redirect: "manual",
      headers: { apikey: key },
      signal: AbortSignal.timeout(15000),
    });
    const location = result.headers.get("location");
    if (result.status !== 302 || !location)
      throw Error("OAuth redirect unavailable");
    const target = new URL(location),
      scope = target.searchParams.get("scope");
    if (
      target.hostname !==
        (provider === "apple" ? "appleid.apple.com" : "kauth.kakao.com") ||
      target.searchParams.get("redirect_uri") !== base + "/auth/v1/callback"
    )
      throw Error("Unexpected OAuth destination");
    if (provider === "kakao" && scope !== "openid")
      throw Error("Unexpected Kakao personal scopes");
    if (
      provider === "apple" &&
      target.searchParams.get("client_id") !== "com.hanseo.mogeum.auth"
    )
      throw Error("Unexpected Apple client");
    results.push({
      provider,
      status: result.status,
      destinationHost: target.hostname,
      scope,
      callbackVerified: true,
    });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    managedDevelopment: true,
    appleEnabled: true,
    kakaoEnabled: true,
    pkce: true,
    redirects: results,
    completedUserLogin: false,
  };
  if (process.argv[2])
    writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
main().catch(() => {
  console.error(
    "Managed OAuth setup verification failed; no credentials or response bodies logged.",
  );
  process.exitCode = 1;
});
