type BetaConfig = {
  name?: string;
  scheme?: unknown;
  owner?: string;
  ios?: { bundleIdentifier?: string };
  android?: { package?: string; blockedPermissions?: string[] };
  extra?: { appVariant?: string; eas?: { projectId?: string } };
};
export function betaBuildProblems(
  config: BetaConfig,
  env: Record<string, string | undefined>,
) {
  const issues: string[] = [];
  if (config.scheme !== "mogeum-beta")
    issues.push("BETA_CALLBACK_SCHEME_REQUIRED");
  if (config.extra?.appVariant !== "beta") issues.push("BETA_VARIANT_REQUIRED");
  if (
    config.owner !== "shinhanseo" ||
    config.extra?.eas?.projectId !== "23fc1222-7a05-4cf5-b061-41787ed71fbe"
  )
    issues.push("EAS_PROJECT_MISMATCH");
  if (
    config.ios?.bundleIdentifier !== "com.hanseo.mogeum" ||
    config.android?.package !== "com.hanseo.mogeum"
  )
    issues.push("BETA_IDENTIFIERS_REQUIRED");
  if (
    env.EXPO_PUBLIC_SUPABASE_URL !== "https://vsckzjfgzdpzkzuumldf.supabase.co"
  )
    issues.push("BETA_BACKEND_MISMATCH");
  if (!env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_"))
    issues.push("PUBLISHABLE_KEY_REQUIRED");
  for (const key of Object.keys(env))
    if (
      key.startsWith("EXPO_PUBLIC_") &&
      ![
        "EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "EXPO_PUBLIC_PRIVACY_URL",
        "EXPO_PUBLIC_TERMS_URL",
      ].includes(key)
    )
      issues.push("UNREVIEWED_PUBLIC_VARIABLE");
  if (
    !config.android?.blockedPermissions?.includes(
      "android.permission.RECORD_AUDIO",
    )
  )
    issues.push("UNUSED_MICROPHONE_PERMISSION");
  return [...new Set(issues)];
}
export function externalBetaProblems(env: Record<string, string | undefined>) {
  const issues: string[] = [];
  for (const [name, code] of [
    ["EXPO_PUBLIC_PRIVACY_URL", "PRIVACY_URL_REQUIRED"],
    ["EXPO_PUBLIC_TERMS_URL", "TERMS_URL_REQUIRED"],
  ] as const) {
    try {
      const u = new URL(env[name] ?? "");
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        /localhost|example\.|\.invalid$|\.test$|YOUR_/i.test(u.hostname)
      )
        throw Error();
    } catch {
      issues.push(code);
    }
  }
  if (env.MOGEUM_BETA_OWNER_REVIEWED !== "1")
    issues.push("OWNER_REVIEW_REQUIRED");
  return issues;
}
