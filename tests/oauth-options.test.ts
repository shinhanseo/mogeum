import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { oauthOptions } from "../src/features/auth/options";
for (const provider of ["kakao", "apple"] as const) {
  test(`${provider} uses the SDK's PKCE flow and exact native callback without unnecessary Kakao personal scopes`, async () => {
    const client = createClient(
      "https://synthetic.supabase.co",
      "synthetic-public-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      },
    );
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: oauthOptions(provider, "mogeum-dev://auth/callback"),
    });
    assert.equal(error, null);
    const url = new URL(data.url!);
    assert.equal(url.origin, "https://synthetic.supabase.co");
    assert.equal(url.pathname, "/auth/v1/authorize");
    assert.equal(url.searchParams.get("provider"), provider);
    assert.equal(
      url.searchParams.get("redirect_to"),
      "mogeum-dev://auth/callback",
    );
    assert.equal(url.searchParams.get("code_challenge_method"), "s256");
    assert.ok(url.searchParams.get("code_challenge"));
    assert.equal(
      url.searchParams.get("scope"),
      provider === "kakao" ? "openid" : null,
    );
    assert.equal(url.searchParams.get("scopes"), null);
  });
}
