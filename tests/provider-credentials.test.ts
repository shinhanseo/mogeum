import assert from "node:assert/strict";
import test from "node:test";
import {
  parseProviderCapture,
  providerSubjects,
  validateProviderCredential,
  revokeProviderCredential,
  encryptProviderCredential,
  decryptProviderCredential,
} from "../supabase/functions/_shared/provider-credentials";
const config = {
  appleClientId: "service",
  appleClientSecret: "server-secret",
  kakaoClientId: "client",
  kakaoClientSecret: "server-secret",
  kakaoAppId: "1621286",
};
const apple = {
  provider: "apple" as const,
  subject: "verified-subject",
  refreshToken: "private-refresh-token",
};
test("capture accepts only provider and bounded refresh token, never caller identity or URLs", () => {
  assert.deepEqual(
    parseProviderCapture({ provider: "apple", refreshToken: "refresh" }),
    { provider: "apple", refreshToken: "refresh" },
  );
  for (const value of [
    { provider: "apple", refreshToken: "refresh", userId: "other" },
    { provider: "google", refreshToken: "refresh" },
    { provider: "apple", refreshToken: "x\r\nheader" },
    null,
  ])
    assert.throws(() => parseProviderCapture(value));
  assert.deepEqual(
    providerSubjects([
      { provider: "email" },
      { provider: "apple", identity_data: { sub: "subject" } },
    ]),
    [{ provider: "apple", subject: "subject" }],
  );
  assert.throws(() =>
    providerSubjects([{ provider: "apple", identity_data: {} }]),
  );
});
test("Apple capture verifies refreshed signed identity before accepting credential; no blind token storage", async () => {
  const calls: string[] = [];
  const send = (async (url, init) => {
    calls.push(String(url));
    assert.equal(
      new URLSearchParams(String(init?.body)).get("client_secret"),
      "server-secret",
    );
    return Response.json({
      access_token: "access",
      id_token: "signed-id",
      refresh_token: "rotated",
    });
  }) as typeof fetch;
  const value = await validateProviderCredential(
    { provider: "apple", refreshToken: "refresh" },
    apple.subject,
    config,
    {
      fetch: send,
      verifyApple: async (token) => {
        assert.equal(token, "signed-id");
        return { sub: apple.subject };
      },
    },
  );
  assert.equal(value.refreshToken, "rotated");
  assert.deepEqual(calls, ["https://appleid.apple.com/auth/token"]);
  await assert.rejects(
    validateProviderCredential(
      { provider: "apple", refreshToken: "refresh" },
      "other",
      config,
      { fetch: send, verifyApple: async () => ({ sub: apple.subject }) },
    ),
    /SUBJECT_MISMATCH/,
  );
});
test("Kakao capture binds refreshed token to the exact app and verified identity", async () => {
  const send = (async (url) =>
    Response.json(
      String(url).includes("access_token_info")
        ? { id: 42, app_id: 1621286 }
        : { access_token: "access" },
    )) as typeof fetch;
  const value = await validateProviderCredential(
    { provider: "kakao", refreshToken: "refresh" },
    "42",
    config,
    {
      fetch: send,
      verifyApple: async () => {
        assert.fail("not Apple");
      },
    },
  );
  assert.equal(value.accessToken, "access");
  await assert.rejects(
    validateProviderCredential(
      { provider: "kakao", refreshToken: "refresh" },
      "43",
      config,
      { fetch: send, verifyApple: async () => ({}) },
    ),
    /SUBJECT_MISMATCH/,
  );
  await assert.rejects(
    validateProviderCredential(
      { provider: "kakao", refreshToken: "refresh" },
      "42",
      { ...config, kakaoAppId: "wrong" },
      { fetch: send, verifyApple: async () => ({}) },
    ),
    /SUBJECT_MISMATCH/,
  );
});
test("encrypted credentials cannot be decrypted by another owner/provider/subject and contain no plain token", async () => {
  const secret = Buffer.alloc(32, 4).toString("base64"),
    encrypted = await encryptProviderCredential("owner", apple, secret);
  assert.ok(!encrypted.includes(apple.refreshToken));
  assert.deepEqual(
    await decryptProviderCredential(
      "owner",
      "apple",
      apple.subject,
      encrypted,
      secret,
    ),
    apple,
  );
  await assert.rejects(
    decryptProviderCredential(
      "other",
      "apple",
      apple.subject,
      encrypted,
      secret,
    ),
  );
  await assert.rejects(
    decryptProviderCredential(
      "owner",
      "kakao",
      apple.subject,
      encrypted,
      secret,
    ),
  );
  await assert.rejects(
    decryptProviderCredential("owner", "apple", "other", encrypted, secret),
  );
});
test("revocation uses fixed endpoints; provider outage is never successful deletion", async () => {
  const send = (async (url, init) => {
    assert.equal(String(url), "https://appleid.apple.com/auth/revoke");
    assert.equal(
      new URLSearchParams(String(init?.body)).get("token"),
      apple.refreshToken,
    );
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  await revokeProviderCredential(apple, config, send);
  await assert.rejects(
    revokeProviderCredential(
      apple,
      config,
      (async () => new Response(null, { status: 503 })) as typeof fetch,
    ),
    /REVOKE_FAILED/,
  );
  const kakao = {
    ...apple,
    provider: "kakao" as const,
    subject: "42",
    accessToken: "access",
  };
  await assert.rejects(
    revokeProviderCredential(kakao, config, (async () =>
      Response.json({ id: 43 })) as typeof fetch),
    /SUBJECT_MISMATCH/,
  );
});
