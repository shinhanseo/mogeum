import type { SignInWithOAuthCredentials } from "@supabase/supabase-js";
/** Supabase's Kakao defaults request Biz-only email/profile scopes; explicitly request OIDC identity only. */
export function oauthOptions(
  provider: "apple" | "kakao",
  redirectTo: string,
): NonNullable<SignInWithOAuthCredentials["options"]> {
  return {
    redirectTo,
    skipBrowserRedirect: true,
    ...(provider === "kakao" ? { queryParams: { scope: "openid" } } : {}),
  };
}
