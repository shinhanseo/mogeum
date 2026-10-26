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

// Exercise the real Hermes string table: adjacent strings must not become a fake key.
test(
  "Hermes artifact inspection preserves SDK prefix boundaries and still rejects full keys",
  { skip: !["darwin", "linux"].includes(process.platform) },
  async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join, resolve } = await import("node:path");
    const { execFileSync, spawnSync } = await import("node:child_process");
    const dir = mkdtempSync(join(tmpdir(), "mogeum-scan-test-"));
    try {
      const compiler = resolve(
        "node_modules/hermes-compiler/hermesc",
        process.platform === "darwin" ? "osx-bin" : "linux64-bin",
        "hermesc",
      );
      for (const [kind, source, expected] of [
        [
          "safe",
          'globalThis.check = ["sb_secret_", "unrelatedLongString"];',
          0,
        ],
        ["unsafe", 'globalThis.check = "sb_secret_' + "x".repeat(32) + '";', 1],
      ] as const) {
        const input = join(dir, kind + ".js"),
          output = join(dir, kind + ".hbc");
        writeFileSync(input, source);
        execFileSync(compiler, ["-emit-binary", "-out", output, input], {
          stdio: "pipe",
        });
        const result = spawnSync(
          process.execPath,
          ["--import", "tsx", "scripts/check-beta-artifact.ts", output],
          { encoding: "utf8" },
        );
        assert.equal(
          result.status,
          expected,
          kind + " artifact classification",
        );
        assert.ok(!result.stdout.includes("x".repeat(32)));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
