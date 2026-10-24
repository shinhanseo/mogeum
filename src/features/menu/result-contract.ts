import {
  productCandidates,
  products,
  PRODUCT_CATALOG_VERSION,
  normalizeProductName,
} from "../../../supabase/functions/_shared/product-catalog";
import type {
  MenuItem,
  MenuRecommendation,
} from "../../../supabase/functions/_shared/menu-domain";
export type MenuResult = {
  evidenceRecords: {
    id: string;
    name: string | null;
    date: string;
    revision: number;
    category: string | null;
    revisit: string | null;
    noteText: string | null;
  }[];
  recommendations: MenuRecommendation[];
  tasteHash: string;
  recordCount: number;
  method: string;
  limitedCatalog: boolean;
  catalogVersion?: string;
  catalogSize?: number;
};
function fail(): never {
  throw new Error("INVALID_MENU_RESULT");
}
const obj = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
const str = (value: unknown, max = 160): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const optionalString = (value: unknown, max: number) =>
  value === null || (typeof value === "string" && value.length <= max);
const array = (value: unknown, max: number): unknown[] =>
  Array.isArray(value) && value.length <= max ? value : fail();
function ids(value: unknown, allowed: Set<string>, nonempty = false): string[] {
  const list = array(value, 1000);
  if (nonempty && !list.length) fail();
  const seen = new Set<string>();
  for (const id of list) {
    if (typeof id !== "string" || !allowed.has(id) || seen.has(id)) fail();
    seen.add(id);
  }
  return list as string[];
}
export function requireCatalogVersion(value: unknown) {
  if (obj(value).catalogVersion !== PRODUCT_CATALOG_VERSION)
    throw new Error("MENU_CATALOG_MISMATCH");
}
/** Validate before exposing a remote result. Ownership is enforced by verified JWT/RLS on the server, not by this client check. */
export function validateMenuResult(
  value: unknown,
  items: MenuItem[],
): MenuResult {
  requireCatalogVersion(value);
  const data = obj(value);
  if (
    data.method !== "evidence-rules-v1" ||
    data.limitedCatalog !== true ||
    !str(data.tasteHash, 128) ||
    !Number.isSafeInteger(data.recordCount) ||
    (data.recordCount as number) < 0
  )
    fail();
  if (data.catalogSize !== products.length) fail();
  const records = array(data.evidenceRecords, 1000);
  if (records.length > (data.recordCount as number)) fail();
  const recordById = new Map<string, Record<string, unknown>>();
  for (const raw of records) {
    const r = obj(raw);
    if (
      !str(r.id) ||
      recordById.has(r.id) ||
      !Number.isSafeInteger(r.revision) ||
      (r.revision as number) < 1 ||
      !str(r.date, 40) ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
        r.date,
      ) ||
      !Number.isFinite(Date.parse(r.date)) ||
      !optionalString(r.name, 300) ||
      !optionalString(r.noteText, 20000) ||
      !new Set<unknown>([null, "whisky", "wine", "beer", "traditional"]).has(
        r.category,
      ) ||
      !new Set<unknown>([null, "again", "okay", "not_for_me"]).has(r.revisit)
    )
      fail();
    recordById.set(r.id as string, r);
  }
  const allowed = new Set(recordById.keys()),
    used = new Set<string>(),
    seen = new Set<string>();
  const confirmed = items.filter((i) => i.confirmed),
    byId = new Map(confirmed.map((i) => [i.id, i]));
  const results = array(data.recommendations, 100);
  if (results.length !== confirmed.length) fail();
  for (const raw of results) {
    const r = obj(raw);
    const item = typeof r.itemId === "string" ? byId.get(r.itemId) : undefined;
    if (!item || seen.has(item.id)) fail();
    seen.add(item.id);
    const product = productCandidates(item.name).find(
      (p) => p.id === item.productId,
    );
    if (r.productId !== (product?.id ?? null)) fail();
    const support = new Set<string>(),
      opposition = new Set<string>(),
      facts = new Set<string>();
    const similar = array(r.similar, 100);
    for (const rawFact of similar) {
      const f = obj(rawFact);
      const feature = product?.features.find((p) => p.id === f.factId);
      if (!feature || f.label !== feature.label || facts.has(feature.id))
        fail();
      facts.add(feature.id);
      const positive = ids(f.recordIds, allowed, true),
        negative = ids(f.negativeIds, allowed);
      if (positive.some((id) => negative.includes(id))) fail();
      if (
        positive.some((id) =>
          ["not_for_me", "okay"].includes(String(recordById.get(id)!.revisit)),
        )
      )
        fail();
      if (
        negative.some((id) =>
          ["again", "okay"].includes(String(recordById.get(id)!.revisit)),
        )
      )
        fail();
      for (const id of positive) {
        used.add(id);
        support.add(`${feature.dimension}:${id}`);
      }
      for (const id of negative) {
        used.add(id);
        opposition.add(`${feature.dimension}:${id}`);
      }
    }
    const other = array(r.other, 100),
      otherKeys = new Set<string>();
    for (const rawOther of other) {
      const o = obj(rawOther);
      const feature = product?.features.find(
        (f) => f.label === o.label && f.dimension === o.dimension,
      );
      if (!feature || facts.has(feature.id) || otherKeys.has(feature.id))
        fail();
      otherKeys.add(feature.id);
    }
    if (facts.size + otherKeys.size !== (product?.features.length ?? 0)) fail();
    const known = ids(r.knownRecordIds, allowed);
    for (const id of known) {
      const record = recordById.get(id)!;
      if (
        typeof record.name !== "string" ||
        normalizeProductName(record.name) !== normalizeProductName(item.name)
      )
        fail();
      used.add(id);
    }
    const expected = !product
      ? "unverified"
      : similar.length
        ? "similar"
        : known.length
          ? "known"
          : "unmatched";
    if (
      r.status !== expected ||
      !Number.isSafeInteger(r.score) ||
      r.score !== support.size - opposition.size + known.length
    )
      fail();
  }
  if (used.size !== allowed.size) fail();
  return value as MenuResult;
}
export function menuFailureMessage(
  error: unknown,
  action: "parse" | "recommend",
) {
  if (error instanceof Error && error.message === "MENU_ITEM_LIMIT")
    return "메뉴는 한 번에 100개까지 확인할 수 있어요. 사진을 나눠서 다시 시도해주세요. 올린 사진과 이전 입력은 보관했어요.";
  if (error instanceof Error && error.message === "MENU_EVIDENCE_STALE")
    return "추천 중 기록이 바뀌었어요. 입력은 보관했어요. 최신 기록으로 다시 추천받아 주세요.";
  if (error instanceof Error && error.message === "MENU_CATALOG_MISMATCH")
    return "앱과 서버의 술 정보 버전이 달라요. 입력은 보관했어요. 업데이트 후 다시 시도해주세요.";
  if (error instanceof Error && error.message === "INVALID_MENU_RESULT")
    return "추천 근거를 확인하지 못했어요. 입력은 보관했어요. 다시 추천받아 주세요.";
  return action === "parse"
    ? "메뉴를 정리하지 못했어요. 연결을 확인하고 다시 시도해주세요."
    : "저장 또는 추천을 완료하지 못했어요. 입력은 보관했어요. 다시 시도해주세요.";
}
