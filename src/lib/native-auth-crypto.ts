import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { installAuthCryptoBridge } from "./auth-crypto-bridge";

/** Keep browser WebCrypto intact. Native digest failures propagate; never fall back to plain PKCE. */
export function ensureNativeAuthCrypto() {
  if (Platform.OS === "web") return;
  if (typeof TextEncoder !== "function" || typeof btoa !== "function")
    throw new Error("NATIVE_AUTH_ENCODING_UNAVAILABLE");
  installAuthCryptoBridge(globalThis, {
    random: (array) => Crypto.getRandomValues(array),
    sha256: (data) => Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data),
  });
}
