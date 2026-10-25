import {
  type Provider,
  type ProviderCredential,
  type ProviderConfig,
  validateProviderCredential,
  revokeProviderCredential,
} from "./provider-credentials.ts";
export class ProviderLoginRequired extends Error {
  constructor(readonly provider: Provider) {
    super("PROVIDER_LOGIN_REQUIRED");
  }
}
export type StoredProvider = {
  provider: Provider;
  subject: string;
  generation: string;
  ciphertext: string;
  revoked: boolean;
};
export async function revokeAccountProviders(
  identities: { provider: Provider; subject: string }[],
  rows: StoredProvider[],
  config: ProviderConfig,
  ports: {
    decrypt: (row: StoredProvider) => Promise<ProviderCredential>;
    rotate: (
      row: StoredProvider,
      credential: ProviderCredential,
    ) => Promise<void>;
    mark: (row: StoredProvider) => Promise<void>;
    fetch: typeof fetch;
    verifyApple: (token: string) => Promise<{ sub?: string }>;
  },
) {
  for (const identity of identities) {
    const row = rows.find(
      (r) => r.provider === identity.provider && r.subject === identity.subject,
    );
    if (!row) throw new ProviderLoginRequired(identity.provider);
    if (row.revoked) continue;
    let credential = await ports.decrypt(row);
    if (
      credential.provider !== identity.provider ||
      credential.subject !== identity.subject
    )
      throw Error("PROVIDER_SUBJECT_MISMATCH");
    try {
      await revokeProviderCredential(credential, config, ports.fetch);
    } catch (error) {
      if (
        identity.provider !== "kakao" ||
        !(error instanceof Error) ||
        error.message !== "PROVIDER_LOGIN_REQUIRED"
      )
        throw error;
      try {
        credential = await validateProviderCredential(
          { provider: "kakao", refreshToken: credential.refreshToken },
          identity.subject,
          config,
          ports,
        );
      } catch (refreshError) {
        if (
          refreshError instanceof Error &&
          refreshError.message === "PROVIDER_TOKEN_REJECTED"
        )
          throw new ProviderLoginRequired("kakao");
        throw refreshError;
      }
      // Persist a rotated refresh token before unlink. A lost response must retain the latest verified credential.
      await ports.rotate(row, credential);
      try {
        await revokeProviderCredential(credential, config, ports.fetch);
      } catch (retryError) {
        if (
          retryError instanceof Error &&
          retryError.message === "PROVIDER_LOGIN_REQUIRED"
        )
          throw new ProviderLoginRequired("kakao");
        throw retryError;
      }
    }
    await ports.mark(row);
  }
}
