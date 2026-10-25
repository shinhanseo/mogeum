export type Provider = "apple" | "kakao";
export type ProviderCredential = {
  provider: Provider;
  subject: string;
  refreshToken: string;
  accessToken?: string;
};
export type ProviderConfig = {
  appleClientId?: string;
  appleClientSecret?: string;
  kakaoClientId?: string;
  kakaoClientSecret?: string;
  kakaoAppId?: string;
};
type Ports = {
  fetch: typeof fetch;
  verifyApple: (token: string) => Promise<{ sub?: string }>;
};
const token = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length <= 20000 &&
  !/[\r\n]/.test(v);
export function parseProviderCapture(body: unknown): {
  provider: Provider;
  refreshToken: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw Error("INVALID_REQUEST");
  const r = body as Record<string, unknown>;
  if (
    Object.keys(r).some((k) => !["provider", "refreshToken"].includes(k)) ||
    !["apple", "kakao"].includes(r.provider as string) ||
    !token(r.refreshToken)
  )
    throw Error("INVALID_REQUEST");
  return { provider: r.provider as Provider, refreshToken: r.refreshToken };
}
export function providerSubjects(
  identities: readonly {
    provider: string;
    identity_data?: Record<string, unknown>;
  }[],
) {
  return identities
    .filter((i) => i.provider === "apple" || i.provider === "kakao")
    .map((i) => {
      const subject = i.identity_data?.sub;
      if (typeof subject !== "string" || !subject || subject.length > 300)
        throw Error("INVALID_PROVIDER_IDENTITY");
      return { provider: i.provider as Provider, subject };
    });
}
export async function validateProviderCredential(
  input: { provider: Provider; refreshToken: string },
  subject: string,
  config: ProviderConfig,
  ports: Ports,
): Promise<ProviderCredential> {
  if (!subject || !token(input.refreshToken)) throw Error("INVALID_CREDENTIAL");
  const apple = input.provider === "apple";
  const clientId = apple ? config.appleClientId : config.kakaoClientId,
    clientSecret = apple ? config.appleClientSecret : config.kakaoClientSecret;
  if (!clientId || !clientSecret) throw Error("PROVIDER_NOT_CONFIGURED");
  const response = await ports.fetch(
    apple
      ? "https://appleid.apple.com/auth/token"
      : "https://kauth.kakao.com/oauth/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: input.refreshToken,
      }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    },
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    if (response.status === 400 && errorBody?.error === "invalid_grant")
      throw Error("PROVIDER_TOKEN_REJECTED");
    throw Error("PROVIDER_REFRESH_RETRY_REQUIRED");
  }
  const body = await response.json();
  if (!token(body.access_token)) throw Error("INVALID_PROVIDER_RESPONSE");
  if (apple) {
    if (
      !token(body.id_token) ||
      (await ports.verifyApple(body.id_token)).sub !== subject
    )
      throw Error("PROVIDER_SUBJECT_MISMATCH");
  } else {
    const info = await ports.fetch(
      "https://kapi.kakao.com/v1/user/access_token_info",
      {
        headers: { Authorization: `Bearer ${body.access_token}` },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      },
    );
    if (!info.ok) {
      if (info.status === 401) throw Error("PROVIDER_TOKEN_REJECTED");
      throw Error("PROVIDER_REFRESH_RETRY_REQUIRED");
    }
    const identity = await info.json();
    if (
      String(identity.id) !== subject ||
      !config.kakaoAppId ||
      String(identity.app_id) !== config.kakaoAppId
    )
      throw Error("PROVIDER_SUBJECT_MISMATCH");
  }
  if (body.refresh_token !== undefined && !token(body.refresh_token))
    throw Error("INVALID_PROVIDER_RESPONSE");
  return {
    provider: input.provider,
    subject,
    refreshToken: body.refresh_token ?? input.refreshToken,
    accessToken: body.access_token,
  };
}
/** All destinations are fixed; provider response text and credentials never become logs or user-facing errors. */
export async function revokeProviderCredential(
  credential: ProviderCredential,
  config: ProviderConfig,
  send: typeof fetch,
) {
  const apple = credential.provider === "apple";
  if (apple) {
    if (!config.appleClientId || !config.appleClientSecret)
      throw Error("PROVIDER_NOT_CONFIGURED");
    const response = await send("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.appleClientId,
        client_secret: config.appleClientSecret,
        token: credential.refreshToken,
        token_type_hint: "refresh_token",
      }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok) throw Error("PROVIDER_REVOKE_FAILED");
    return;
  }
  if (!credential.accessToken) throw Error("PROVIDER_LOGIN_REQUIRED");
  const response = await send("https://kapi.kakao.com/v1/user/unlink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (response.status === 401) throw Error("PROVIDER_LOGIN_REQUIRED");
  if (!response.ok) throw Error("PROVIDER_REVOKE_FAILED");
  const body = await response.json();
  if (String(body.id) !== credential.subject)
    throw Error("PROVIDER_SUBJECT_MISMATCH");
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
async function encryptionKey(secret: string) {
  const bytes = decode(secret);
  if (bytes.length !== 32) throw Error("INVALID_ENCRYPTION_KEY");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
const aad = (owner: string, provider: Provider, subject: string) =>
  new TextEncoder().encode(JSON.stringify([owner, provider, subject]));
export async function encryptProviderCredential(
  owner: string,
  value: ProviderCredential,
  secret: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad(owner, value.provider, value.subject),
    },
    await encryptionKey(secret),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
export async function decryptProviderCredential(
  owner: string,
  provider: Provider,
  subject: string,
  value: string,
  secret: string,
): Promise<ProviderCredential> {
  const [version, iv, data, ...extra] = value.split(".");
  if (version !== "v1" || !iv || !data || extra.length)
    throw Error("INVALID_CIPHERTEXT");
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(iv),
      additionalData: aad(owner, provider, subject),
    },
    await encryptionKey(secret),
    decode(data),
  );
  const credential = JSON.parse(new TextDecoder().decode(plain));
  if (
    credential.provider !== provider ||
    credential.subject !== subject ||
    !token(credential.refreshToken)
  )
    throw Error("INVALID_CREDENTIAL");
  return credential;
}
