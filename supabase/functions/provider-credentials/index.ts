import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.13";
import {
  parseProviderCapture,
  providerSubjects,
  validateProviderCredential,
  encryptProviderCredential,
} from "../_shared/provider-credentials.ts";
import { readMenuBody } from "../_shared/menu-body.ts";
const jwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (code: string, status = 200) =>
  Response.json(
    { code },
    { status, headers: { ...cors, "Cache-Control": "no-store" } },
  );
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST") return reply("METHOD_NOT_ALLOWED", 405);
  const bearer = request.headers
    .get("Authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!bearer) return reply("UNAUTHENTICATED", 401);
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    encryption = Deno.env.get("MOGEUM_PROVIDER_CREDENTIAL_KEY");
  if (!url || !key || !encryption) return reply("NOT_CONFIGURED", 503);
  const signal = AbortSignal.timeout(25000);
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
  });
  const user = await admin.auth.getUser(bearer);
  if (user.error || !user.data.user) return reply("UNAUTHENTICATED", 401);
  let input;
  try {
    input = parseProviderCapture(
      JSON.parse(await readMenuBody(request, 24000)),
    );
  } catch {
    return reply("INVALID_REQUEST", 400);
  }
  try {
    const identity = providerSubjects(user.data.user.identities ?? []).find(
      (i) => i.provider === input.provider,
    );
    if (!identity) return reply("PROVIDER_IDENTITY_MISMATCH", 403);
    const config = {
      appleClientId: Deno.env.get("APPLE_CLIENT_ID"),
      appleClientSecret: Deno.env.get("APPLE_CLIENT_SECRET"),
      kakaoClientId: Deno.env.get("KAKAO_CLIENT_ID"),
      kakaoClientSecret: Deno.env.get("KAKAO_CLIENT_SECRET"),
      kakaoAppId: Deno.env.get("KAKAO_APP_ID"),
    };
    const credential = await validateProviderCredential(
      input,
      identity.subject,
      config,
      {
        fetch,
        verifyApple: async (token) => {
          const verified = await jwtVerify(token, jwks, {
            issuer: "https://appleid.apple.com",
            audience: config.appleClientId,
            algorithms: ["RS256"],
          });
          return { sub: verified.payload.sub };
        },
      },
    );
    const ciphertext = await encryptProviderCredential(
      user.data.user.id,
      credential,
      encryption,
    );
    const saved = await admin.rpc("store_provider_credential", {
      p_owner: user.data.user.id,
      p_provider: identity.provider,
      p_subject: identity.subject,
      p_ciphertext: ciphertext,
      p_generation: crypto.randomUUID(),
    });
    if (saved.error) throw Error("SAVE_FAILED");
    return reply("STORED");
  } catch {
    return reply("PROVIDER_CREDENTIAL_RETRY_REQUIRED", 503);
  }
});
