import {
  encryptProviderCredential,
  providerSubjects,
  validateProviderCredential,
  type Provider,
  type ProviderConfig,
} from "./provider-credentials.ts";
export async function captureVerifiedProvider(
  owner: string,
  identities: Parameters<typeof providerSubjects>[0],
  input: { provider: Provider; refreshToken: string },
  config: ProviderConfig,
  encryption: string,
  ports: {
    receipt: (value: {
      owner: string;
      provider: Provider;
      subject: string;
      captureHash: string;
    }) => Promise<boolean>;
    store: (value: {
      owner: string;
      provider: Provider;
      subject: string;
      captureHash: string;
      ciphertext: string;
      generation: string;
    }) => Promise<void>;
    fetch: typeof fetch;
    verifyApple: (token: string) => Promise<{ sub?: string }>;
  },
) {
  const identity = providerSubjects(identities).find(
    (i) => i.provider === input.provider,
  );
  if (!identity) throw Error("PROVIDER_IDENTITY_MISMATCH");
  const captureHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(input.refreshToken),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const receipt = {
    owner,
    provider: identity.provider,
    subject: identity.subject,
    captureHash,
  };
  if (await ports.receipt(receipt)) return;
  const credential = await validateProviderCredential(
    input,
    identity.subject,
    config,
    ports,
  );
  const ciphertext = await encryptProviderCredential(
    owner,
    credential,
    encryption,
  );
  await ports.store({
    ...receipt,
    ciphertext,
    generation: crypto.randomUUID(),
  });
}
