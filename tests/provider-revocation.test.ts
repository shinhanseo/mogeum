import assert from "node:assert/strict";
import test from "node:test";
import {
  revokeAccountProviders,
  ProviderLoginRequired,
  type StoredProvider,
} from "../supabase/functions/_shared/provider-revocation";
const apple = { provider: "apple" as const, subject: "A" },
  kakao = { provider: "kakao" as const, subject: "K" };
const row = (identity: typeof apple | typeof kakao): StoredProvider => ({
  ...identity,
  generation: "generation",
  ciphertext: "ciphertext",
  revoked: false,
});
function fixture() {
  const events: string[] = [];
  return {
    events,
    ports: {
      decrypt: async (r: StoredProvider) => ({
        ...r,
        refreshToken: "refresh",
        accessToken: "expired-access",
      }),
      rotate: async () => {
        events.push("rotate");
      },
      mark: async (r: StoredProvider) => {
        events.push(`mark-${r.provider}`);
      },
      fetch: (async (url) => {
        events.push(String(url));
        return String(url).includes("/unlink")
          ? Response.json({ id: "K" })
          : new Response(null, { status: 200 });
      }) as typeof fetch,
      verifyApple: async () => ({ sub: "A" }),
    },
  };
}
const config = {
  appleClientId: "service",
  appleClientSecret: "secret",
  kakaoClientId: "client",
  kakaoClientSecret: "secret",
  kakaoAppId: "1621286",
};
test("provider receipts prevent repeating a completed unlink after another provider failed", async () => {
  const f = fixture();
  await revokeAccountProviders(
    [apple, kakao],
    [{ ...row(apple), revoked: true }, row(kakao)],
    config,
    f.ports,
  );
  assert.deepEqual(f.events, [
    "https://kapi.kakao.com/v1/user/unlink",
    "mark-kakao",
  ]);
});
test("missing credential requires its provider login without calling a revocation endpoint", async () => {
  const f = fixture();
  await assert.rejects(
    revokeAccountProviders([apple], [], config, f.ports),
    (error) =>
      error instanceof ProviderLoginRequired && error.provider === "apple",
  );
  assert.deepEqual(f.events, []);
});
test("Kakao token rotation is durable before unlink and verifies the new subject/app", async () => {
  const f = fixture();
  let unlinks = 0;
  f.ports.fetch = (async (url) => {
    const u = String(url);
    f.events.push(u);
    if (u.includes("/unlink")) {
      unlinks++;
      return unlinks === 1
        ? new Response(null, { status: 401 })
        : Response.json({ id: "K" });
    }
    if (u.includes("access_token_info"))
      return Response.json({ id: "K", app_id: 1621286 });
    return Response.json({
      access_token: "fresh-access",
      refresh_token: "fresh-refresh",
    });
  }) as typeof fetch;
  await revokeAccountProviders([kakao], [row(kakao)], config, f.ports);
  assert.equal(
    f.events.indexOf("rotate") <
      f.events.lastIndexOf("https://kapi.kakao.com/v1/user/unlink"),
    true,
  );
  assert.equal(f.events.at(-1), "mark-kakao");
});
test("lost unlink response followed by revoked refresh never becomes false completion", async () => {
  const f = fixture();
  f.ports.fetch = (async (url) =>
    new Response(null, {
      status: String(url).includes("/unlink") ? 401 : 400,
    })) as typeof fetch;
  await assert.rejects(
    revokeAccountProviders([kakao], [row(kakao)], config, f.ports),
    (error) =>
      error instanceof ProviderLoginRequired && error.provider === "kakao",
  );
  assert.ok(!f.events.includes("mark-kakao"));
});
test("provider outage keeps its receipt incomplete", async () => {
  const f = fixture();
  f.ports.fetch = (async () =>
    new Response(null, { status: 503 })) as typeof fetch;
  await assert.rejects(
    revokeAccountProviders([apple], [row(apple)], config, f.ports),
    /REVOKE_FAILED/,
  );
  assert.deepEqual(f.events, []);
});
