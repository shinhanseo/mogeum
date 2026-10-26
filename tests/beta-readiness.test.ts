import assert from "node:assert/strict";
import test from "node:test";
import {
  betaBuildProblems,
  externalBetaProblems,
} from "../src/lib/beta-readiness";
const config = {
  scheme: "mogeum-beta",
  owner: "shinhanseo",
  ios: { bundleIdentifier: "com.hanseo.mogeum" },
  android: {
    package: "com.hanseo.mogeum",
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
  },
  extra: {
    appVariant: "beta",
    eas: { projectId: "23fc1222-7a05-4cf5-b061-41787ed71fbe" },
  },
};
const env = {
  EXPO_PUBLIC_SUPABASE_URL: "https://vsckzjfgzdpzkzuumldf.supabase.co",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
};
test("beta build rejects development identity, wrong backend and any unreviewed public variable", () => {
  assert.deepEqual(betaBuildProblems(config, env), []);
  assert.ok(
    betaBuildProblems(
      { ...config, extra: { ...config.extra, appVariant: "development" } },
      env,
    ).includes("BETA_VARIANT_REQUIRED"),
  );
  assert.ok(
    betaBuildProblems(config, {
      ...env,
      EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    }).includes("BETA_BACKEND_MISMATCH"),
  );
  assert.ok(
    betaBuildProblems(
      {
        ...config,
        android: { ...config.android, package: "com.example.mogeum.dev" },
      },
      env,
    ).includes("BETA_IDENTIFIERS_REQUIRED"),
  );
  const problems = betaBuildProblems(config, {
    ...env,
    EXPO_PUBLIC_GEMINI_KEY: "synthetic-secret",
  });
  assert.ok(problems.includes("UNREVIEWED_PUBLIC_VARIABLE"));
  assert.ok(!JSON.stringify(problems).includes("synthetic-secret"));
});
test("a technically buildable app is not presented as approved for external distribution", () => {
  assert.deepEqual(externalBetaProblems(env), [
    "PRIVACY_URL_REQUIRED",
    "TERMS_URL_REQUIRED",
    "OWNER_REVIEW_REQUIRED",
  ]);
  assert.ok(
    externalBetaProblems({
      EXPO_PUBLIC_PRIVACY_URL: "https://user:password@site.invalid/privacy",
    }).includes("PRIVACY_URL_REQUIRED"),
  );
  assert.deepEqual(
    externalBetaProblems({
      EXPO_PUBLIC_PRIVACY_URL: "https://mogeum.app/privacy",
      EXPO_PUBLIC_TERMS_URL: "https://mogeum.app/terms",
      MOGEUM_BETA_OWNER_REVIEWED: "1",
    }),
    [],
  );
});
