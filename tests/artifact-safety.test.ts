import assert from "node:assert/strict";
import test from "node:test";
import { artifactSafetyProblems } from "../src/lib/artifact-safety";
const jwt = (role: string) =>
  `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
const realForm = (role: string) =>
  jwt(role).replace("e30.", "eyJ0eXAiOiJKV1QifQ.");
test("built artifact scan allows public configuration but rejects privileged keys without returning secret material", () => {
  assert.deepEqual(
    artifactSafetyProblems(`sb_publishable_synthetic ${realForm("anon")}`),
    [],
  );
  const cases = [
    ["AIza" + "x".repeat(34), "GOOGLE_SERVER_KEY_IN_ARTIFACT"],
    ["sb_secret_" + "x".repeat(20), "SUPABASE_SECRET_KEY_IN_ARTIFACT"],
    [realForm("service_role"), "SERVICE_ROLE_JWT_IN_ARTIFACT"],
    ["-----BEGIN PRIVATE KEY-----", "PRIVATE_KEY_IN_ARTIFACT"],
  ];
  for (const [secret, code] of cases) {
    const result = artifactSafetyProblems(Buffer.from(secret));
    assert.deepEqual(result, [code]);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});
test("public beta bundle cannot contain executable developer probes", () => {
  assert.deepEqual(artifactSafetyProblems("native-record-probe"), [
    "DEV_PROBE_IN_ARTIFACT",
  ]);
});
