import { accountStorage as AsyncStorage } from "../auth/account-storage";
import { randomUUID } from "expo-crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWishlistQueue, type WishlistOperation } from "./wishlist";
import { applyWishlist, loadWishlist } from "./wishlist-repository";
const key = (owner: string) => `mogeum:wishlist:v1:${owner}`;
const repositories = new WeakMap<
  SupabaseClient,
  ReturnType<typeof makeRepository>
>();
function makeRepository(client: SupabaseClient) {
  let activeOwner: string | null = null,
    authVersion = 0;
  client.auth.onAuthStateChange((_event, session) => {
    authVersion++;
    activeOwner = session?.user.id ?? null;
  });
  const version = authVersion;
  const initialized = client.auth.getSession().then(({ data, error }) => {
    if (version === authVersion)
      activeOwner = error ? null : (data.session?.user.id ?? null);
  });
  const queue = createWishlistQueue({
    active: (owner) => activeOwner === owner,
    read: (owner) => AsyncStorage.getItem(key(owner)),
    write: (owner, raw) => AsyncStorage.setItem(key(owner), raw),
    remove: (owner) => AsyncStorage.removeItem(key(owner)),
    apply: (operation) => applyWishlist(client, operation),
    refresh: (owner) => loadWishlist(client, owner),
  });
  return {
    async resume(owner: string) {
      await initialized;
      return queue.resume(owner);
    },
    async set(
      owner: string,
      productId: string,
      saved: boolean,
      expectedRevision: number,
    ) {
      await initialized;
      const operation: WishlistOperation = {
        version: 1,
        owner,
        operationId: randomUUID(),
        productId,
        saved,
        expectedRevision,
      };
      return queue.submit(operation);
    },
  };
}
/** One queue and auth observer per application SDK, shared by all discovery screens. */
export function wishlistRepository(client: SupabaseClient) {
  let repository = repositories.get(client);
  if (!repository) {
    repository = makeRepository(client);
    repositories.set(client, repository);
  }
  return repository;
}
