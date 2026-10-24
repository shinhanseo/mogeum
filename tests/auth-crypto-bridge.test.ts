import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { installAuthCryptoBridge } from "../src/lib/auth-crypto-bridge";

test("native S256 bridge matches RFC7636 instead of returning the verifier", async () => {
  const host: Parameters<typeof installAuthCryptoBridge>[0] = {};
  installAuthCryptoBridge(host, {
    random: (array) => webcrypto.getRandomValues(array),
    sha256: (data) => webcrypto.subtle.digest("SHA-256", data),
  });
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const digest = await host.crypto!.subtle!.digest!(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  assert.equal(
    Buffer.from(digest).toString("base64url"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
  const random = new Uint32Array(56);
  assert.equal(host.crypto!.getRandomValues!(random), random);
  assert.ok(random.some((value) => value !== 0));
  await assert.rejects(
    host.crypto!.subtle!.digest!("SHA-1", new Uint8Array()),
    /UNSUPPORTED_AUTH_DIGEST/,
  );
});

test("existing crypto implementations stay intact and native failures never silently downgrade", async () => {
  const sentinel = async () => new ArrayBuffer(32);
  const random = <T extends ArrayBufferView>(array: T) => array;
  const host = {
    crypto: { getRandomValues: random, subtle: { digest: sentinel } },
  };
  const native = {
    random,
    sha256: async () => {
      throw new Error("NATIVE_DIGEST_FAILED");
    },
  };
  installAuthCryptoBridge(host, native);
  assert.equal(host.crypto.getRandomValues, random);
  assert.equal(host.crypto.subtle.digest, sentinel);
  const missing: Parameters<typeof installAuthCryptoBridge>[0] = {};
  installAuthCryptoBridge(missing, native);
  await assert.rejects(
    missing.crypto!.subtle!.digest!({ name: "SHA-256" }, new Uint8Array()),
    /NATIVE_DIGEST_FAILED/,
  );
});
