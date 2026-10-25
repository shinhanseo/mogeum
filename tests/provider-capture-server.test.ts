import { test } from "node:test";
import assert from "node:assert/strict";
import { captureVerifiedProvider } from "../supabase/functions/_shared/provider-capture";
import { decryptProviderCredential } from "../supabase/functions/_shared/provider-credentials";
const owner = "verified-owner",
  subject = "verified-apple-subject",
  input = { provider: "apple" as const, refreshToken: "private-original" },
  identities = [{ provider: "apple", identity_data: { sub: subject } }];
const config = { appleClientId: "service", appleClientSecret: "server-only" };
const secret = Buffer.alloc(32, 8).toString("base64");
test("lost capture acknowledgement replays its bound receipt without refreshing a rotated token twice", async () => {
  const stored = new Map<string, { ciphertext: string }>();
  let calls = 0,
    lose = true;
  const ports = {
    receipt: async (v: {
      owner: string;
      subject: string;
      captureHash: string;
    }) => stored.has(JSON.stringify([v.owner, v.subject, v.captureHash])),
    store: async (v: {
      owner: string;
      subject: string;
      captureHash: string;
      ciphertext: string;
    }) => {
      assert.ok(!v.ciphertext.includes(input.refreshToken));
      stored.set(JSON.stringify([v.owner, v.subject, v.captureHash]), v);
      if (lose) {
        lose = false;
        throw Error("response lost");
      }
    },
    fetch: (async () => {
      calls++;
      return Response.json({
        access_token: "private-access",
        refresh_token: "private-rotated",
        id_token: "signed-identity",
      });
    }) as typeof fetch,
    verifyApple: async () => ({ sub: subject }),
  };
  await assert.rejects(
    captureVerifiedProvider(owner, identities, input, config, secret, ports),
    /response lost/,
  );
  await captureVerifiedProvider(
    owner,
    identities,
    input,
    config,
    secret,
    ports,
  );
  assert.equal(calls, 1);
  const first = [...stored.values()][0];
  const decrypted = await decryptProviderCredential(
    owner,
    "apple",
    subject,
    first.ciphertext,
    secret,
  );
  assert.equal(decrypted.refreshToken, "private-rotated");
  await captureVerifiedProvider(
    "another-owner",
    identities,
    input,
    config,
    secret,
    ports,
  );
  assert.equal(calls, 2);
});
test("identity and receipt checks happen before any external refresh; missing migrations do not consume provider tokens", async () => {
  const ports = {
    receipt: async () => {
      throw Error("receipt unavailable");
    },
    store: async () => assert.fail("no store"),
    fetch: (async () => assert.fail("no refresh")) as typeof fetch,
    verifyApple: async () => ({ sub: subject }),
  };
  await assert.rejects(
    captureVerifiedProvider(owner, [], input, config, secret, ports),
    /IDENTITY_MISMATCH/,
  );
  await assert.rejects(
    captureVerifiedProvider(owner, identities, input, config, secret, ports),
    /receipt unavailable/,
  );
});
