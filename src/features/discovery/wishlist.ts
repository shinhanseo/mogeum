import { products } from "../../../supabase/functions/_shared/product-catalog";
export type WishlistState = {
  productId: string;
  saved: boolean;
  revision: number;
};
export type WishlistReceipt = WishlistState & { replayed: boolean };
export type WishlistOperation = {
  version: 1;
  owner: string;
  operationId: string;
  productId: string;
  saved: boolean;
  expectedRevision: number;
  receipt?: WishlistReceipt;
  rejected?: true;
};
export type WishlistResolution = {
  state: WishlistState[];
  conflicted: boolean;
};
type Ports = {
  active: (owner: string) => boolean;
  read: (owner: string) => Promise<string | null>;
  write: (owner: string, raw: string) => Promise<void>;
  remove: (owner: string) => Promise<void>;
  apply: (operation: WishlistOperation) => Promise<unknown>;
  refresh: (owner: string) => Promise<unknown>;
};
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const invalid = (): never => {
  throw new Error("INVALID_WISHLIST");
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  return v as Record<string, unknown>;
}
function state(value: unknown): WishlistState {
  const v = object(value);
  if (
    !products.some((p) => p.id === v.productId) ||
    typeof v.saved !== "boolean" ||
    !Number.isSafeInteger(v.revision) ||
    (v.revision as number) < 1
  )
    return invalid();
  return {
    productId: v.productId as string,
    saved: v.saved,
    revision: v.revision as number,
  };
}
export function parseWishlist(value: unknown): WishlistState[] {
  if (!Array.isArray(value) || value.length > products.length) return invalid();
  const rows = value.map(state);
  if (new Set(rows.map((r) => r.productId)).size !== rows.length)
    return invalid();
  return rows;
}
export function parseWishlistReceipt(
  value: unknown,
  operation: WishlistOperation,
): WishlistReceipt {
  const v = object(value),
    row = state(v);
  if (
    row.productId !== operation.productId ||
    row.saved !== operation.saved ||
    row.revision !== operation.expectedRevision + 1 ||
    typeof v.replayed !== "boolean"
  )
    return invalid();
  return { ...row, replayed: v.replayed };
}
export function decodeWishlistOperation(
  raw: string,
  owner: string,
): WishlistOperation {
  if (raw.length > 4096) return invalid();
  const v = object(JSON.parse(raw));
  if (
    v.version !== 1 ||
    v.owner !== owner ||
    !uuid(owner) ||
    !uuid(v.operationId) ||
    !products.some((p) => p.id === v.productId) ||
    typeof v.saved !== "boolean" ||
    !Number.isSafeInteger(v.expectedRevision) ||
    (v.expectedRevision as number) < 0 ||
    (v.expectedRevision as number) >= 2147483647 ||
    (v.rejected !== undefined && v.rejected !== true) ||
    (v.rejected && v.receipt)
  )
    return invalid();
  const operation: WishlistOperation = {
    version: 1,
    owner,
    operationId: v.operationId as string,
    productId: v.productId as string,
    saved: v.saved,
    expectedRevision: v.expectedRevision as number,
  };
  if (v.receipt !== undefined)
    operation.receipt = parseWishlistReceipt(v.receipt, operation);
  if (v.rejected) operation.rejected = true;
  return operation;
}
/** A shared account queue makes the durable request authoritative across screen mounts. */
export function createWishlistQueue(ports: Ports) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(owner: string, run: () => Promise<T>): Promise<T> {
    const next = (queues.get(owner) ?? Promise.resolve())
      .catch(() => {})
      .then(run);
    queues.set(owner, next);
    void next
      .finally(() => {
        if (queues.get(owner) === next) queues.delete(owner);
      })
      .catch(() => {});
    return next;
  }
  function check(owner: string) {
    if (!ports.active(owner)) throw new Error("WISHLIST_ACCOUNT_CHANGED");
  }
  async function finish(
    operation: WishlistOperation,
  ): Promise<WishlistResolution> {
    const owner = operation.owner;
    check(owner);
    if (!operation.receipt && !operation.rejected) {
      try {
        const receipt = parseWishlistReceipt(
          await ports.apply(operation),
          operation,
        );
        operation = { ...operation, receipt };
      } catch (error) {
        // Only an explicit server rejection proves no mutation was committed.
        if ((error as { code?: string })?.code !== "STALE_WISHLIST")
          throw error;
        operation = { ...operation, rejected: true };
      }
      // Save to the initiating account even if the visible account changed during RPC.
      await ports.write(owner, JSON.stringify(operation));
    }
    check(owner);
    const current = parseWishlist(await ports.refresh(owner));
    check(owner);
    // A historical receipt may precede a newer toggle on another device.
    const row = current.find((r) => r.productId === operation.productId);
    if (
      !operation.rejected &&
      (!row ||
        row.revision < operation.receipt!.revision ||
        (row.revision === operation.receipt!.revision &&
          row.saved !== operation.receipt!.saved))
    )
      throw new Error("WISHLIST_REFRESH_INCONSISTENT");
    await ports.remove(owner);
    check(owner);
    return { state: current, conflicted: operation.rejected === true };
  }
  return {
    resume(owner: string): Promise<WishlistResolution | null> {
      return enqueue(owner, async () => {
        check(owner);
        const raw = await ports.read(owner);
        return raw === null
          ? null
          : finish(decodeWishlistOperation(raw, owner));
      });
    },
    submit(input: WishlistOperation): Promise<WishlistResolution> {
      // Capture now: callers cannot alter a queued write by mutating their object later.
      const captured = decodeWishlistOperation(
        JSON.stringify(input),
        input.owner,
      );
      if (captured.receipt || captured.rejected)
        return Promise.reject(new Error("INVALID_WISHLIST"));
      return enqueue(captured.owner, async () => {
        check(captured.owner);
        const raw = await ports.read(captured.owner);
        if (raw !== null) {
          const existing = decodeWishlistOperation(raw, captured.owner);
          const identity = (o: WishlistOperation) =>
            JSON.stringify([
              o.owner,
              o.operationId,
              o.productId,
              o.saved,
              o.expectedRevision,
            ]);
          if (identity(existing) !== identity(captured))
            throw new Error("WISHLIST_PENDING");
          return finish(existing);
        }
        check(captured.owner);
        await ports.write(captured.owner, JSON.stringify(captured));
        return finish(captured);
      });
    },
  };
}
