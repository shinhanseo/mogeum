/** An explicit release target prevents an ambient CLI link from selecting another project. */
export const BACKEND_TARGETS = {
  development: {
    ref: "vsckzjfgzdpzkzuumldf",
    url: "https://vsckzjfgzdpzkzuumldf.supabase.co",
  },
} as const;
export const BACKEND_FUNCTIONS = [
  "taste-summary",
  "menu-recommend",
  "next-drinks",
  "delete-account",
  "provider-credentials",
] as const;
export const REQUIRED_BACKEND_SECRETS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_MODEL",
  "MOGEUM_PROVIDER_CREDENTIAL_KEY",
  "APPLE_CLIENT_ID",
  "APPLE_CLIENT_SECRET",
  "KAKAO_CLIENT_ID",
  "KAKAO_CLIENT_SECRET",
  "KAKAO_APP_ID",
] as const;
export function backendTarget(name: string) {
  if (name !== "development") throw Error("BACKEND_TARGET_NOT_REGISTERED");
  return BACKEND_TARGETS.development;
}
export function backendMetadataProblems(
  functions: { slug?: string; status?: string; verify_jwt?: boolean }[],
  secrets: { name?: string }[],
) {
  const issues: string[] = [];
  for (const slug of BACKEND_FUNCTIONS) {
    const fn = functions.find((f) => f.slug === slug);
    if (!fn || fn.status !== "ACTIVE")
      issues.push(`FUNCTION_NOT_ACTIVE:${slug}`);
    // Each handler verifies the signed user through Auth.getUser. The gateway must
    // allow publishable keys to reach that handler, never treat them as identity.
    else if (fn.verify_jwt !== false)
      issues.push(`GATEWAY_CONFIGURATION_MISMATCH:${slug}`);
  }
  for (const name of REQUIRED_BACKEND_SECRETS)
    if (!secrets.some((s) => s.name === name))
      issues.push(`SECRET_MISSING:${name}`);
  return issues;
}

export function migrationLedgerProblems(
  expected: string[],
  rows: { local?: string; remote?: string }[],
) {
  const remote = new Set(rows.map((r) => r.remote).filter(Boolean));
  const expectedSet = new Set(expected);
  const issues: string[] = [];
  for (const version of expected)
    if (!remote.has(version)) issues.push(`MIGRATION_NOT_TRACKED:${version}`);
  for (const version of remote)
    if (version && !expectedSet.has(version))
      issues.push(`REMOTE_MIGRATION_UNKNOWN:${version}`);
  return issues;
}
