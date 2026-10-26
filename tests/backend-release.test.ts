import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKEND_FUNCTIONS,
  REQUIRED_BACKEND_SECRETS,
  backendTarget,
  backendMetadataProblems,
  migrationLedgerProblems,
} from "../src/lib/backend-release";
test("backend release cannot silently select an unknown or production target", () => {
  assert.equal(backendTarget("development").ref, "vsckzjfgzdpzkzuumldf");
  for (const name of ["production", "", "meomun", "../development"])
    assert.throws(() => backendTarget(name));
});
test("release audit requires all active handlers, handler auth configuration and server secret names", () => {
  const functions = BACKEND_FUNCTIONS.map((slug) => ({
    slug,
    status: "ACTIVE",
    verify_jwt: false,
  }));
  const secrets = REQUIRED_BACKEND_SECRETS.map((name) => ({
    name,
    value: "do-not-log-secret-material",
  }));
  assert.deepEqual(backendMetadataProblems(functions, secrets), []);
  assert.ok(
    backendMetadataProblems(functions.slice(1), secrets).includes(
      "FUNCTION_NOT_ACTIVE:taste-summary",
    ),
  );
  assert.ok(
    backendMetadataProblems(
      [{ ...functions[0], verify_jwt: true }, ...functions.slice(1)],
      secrets,
    ).includes("GATEWAY_CONFIGURATION_MISMATCH:taste-summary"),
  );
  const missing = backendMetadataProblems(functions, []);
  assert.ok(missing.includes("SECRET_MISSING:GOOGLE_GENERATIVE_AI_API_KEY"));
  assert.ok(!JSON.stringify(missing).includes("do-not-log-secret-material"));
});

test("manually applied but untracked migrations block automatic deployment", () => {
  assert.deepEqual(
    migrationLedgerProblems(
      ["001", "002"],
      [
        { local: "001", remote: "001" },
        { local: "002", remote: "" },
      ],
    ),
    ["MIGRATION_NOT_TRACKED:002"],
  );
  assert.deepEqual(
    migrationLedgerProblems(["001"], [{ remote: "001" }, { remote: "999" }]),
    ["REMOTE_MIGRATION_UNKNOWN:999"],
  );
  assert.deepEqual(
    migrationLedgerProblems(["001"], [{ local: "001", remote: "001" }]),
    [],
  );
});
