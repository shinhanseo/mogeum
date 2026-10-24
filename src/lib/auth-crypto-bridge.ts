type Digest = (
  algorithm: string | { name: string },
  data: BufferSource,
) => Promise<ArrayBuffer>;
type Random = (array: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;
type CryptoHost = {
  crypto?: {
    getRandomValues?: Random;
    subtle?: { digest?: Digest };
  };
};

/** Minimal native bridge for Supabase's PKCE S256 path, not a complete WebCrypto implementation. */
export function installAuthCryptoBridge(
  host: CryptoHost,
  native: {
    random: Random;
    sha256: (data: BufferSource) => Promise<ArrayBuffer>;
  },
) {
  const crypto = host.crypto ?? {};
  if (typeof crypto.getRandomValues !== "function")
    Object.defineProperty(crypto, "getRandomValues", {
      configurable: true,
      value: native.random,
    });
  if (typeof crypto.subtle?.digest !== "function") {
    const subtle = crypto.subtle ?? {};
    Object.defineProperty(subtle, "digest", {
      configurable: true,
      value: async (
        algorithm: string | { name: string },
        data: BufferSource,
      ) => {
        const name =
          typeof algorithm === "string" ? algorithm : algorithm?.name;
        if (typeof name !== "string" || name.toUpperCase() !== "SHA-256")
          throw new Error("UNSUPPORTED_AUTH_DIGEST");
        return native.sha256(data);
      },
    });
    if (!crypto.subtle)
      Object.defineProperty(crypto, "subtle", {
        configurable: true,
        value: subtle,
      });
  }
  if (!host.crypto)
    Object.defineProperty(host, "crypto", {
      configurable: true,
      value: crypto,
    });
}
