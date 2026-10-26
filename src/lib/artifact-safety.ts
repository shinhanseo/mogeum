/** Inspect built bytes without returning any matched credentials. Public anon JWTs are allowed. */
export function artifactSafetyProblems(input: Uint8Array | string) {
  const text =
    typeof input === "string" ? input : Buffer.from(input).toString("utf8");
  const issues: string[] = [];
  if (/AIza[0-9A-Za-z_-]{30,}/.test(text))
    issues.push("GOOGLE_SERVER_KEY_IN_ARTIFACT");
  if (/sb_secret_[0-9A-Za-z_-]{12,}/.test(text))
    issues.push("SUPABASE_SECRET_KEY_IN_ARTIFACT");
  if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text))
    issues.push("PRIVATE_KEY_IN_ARTIFACT");
  for (const match of text.matchAll(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  )) {
    try {
      const payload = JSON.parse(
        Buffer.from(match[0].split(".")[1], "base64url").toString("utf8"),
      );
      if (payload.role === "service_role")
        issues.push("SERVICE_ROLE_JWT_IN_ARTIFACT");
    } catch {
      /* not a literal JWT */
    }
  }
  if (
    ["cutout-storage-probe", "native-record-probe", "local-ui-session"].some(
      (marker) => text.includes(marker),
    )
  )
    issues.push("DEV_PROBE_IN_ARTIFACT");
  return [...new Set(issues)];
}
