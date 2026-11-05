import { analyzeTaste, type TasteSnapshot } from "./taste-domain.ts";
import { discoverDrinks, type DrinkHistory } from "./next-drinks-domain.ts";
import { normalizeProductName, type Product } from "./product-catalog.ts";
import { parseCatalogDocument } from "./catalog-contract.ts";
import { researchQuery, type ResearchQuery } from "./product-research.ts";
export const BARTENDER_VERSION = "bartender-v1";
export const categories = ["whisky", "wine", "beer", "traditional"] as const;
export type Conditions = {
  category: Product["category"] | null;
  desired: string[];
  avoid: string[];
  budget: number | null;
  food: string | null;
};
export type ChatCard = {
  product: Product;
  basis: "records" | "today" | "research";
  evidence: { label: string; recordIds: string[] }[];
  matched: string[];
  unknown: string[];
  saved: boolean;
};
export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  cards?: ChatCard[];
};
export type Conversation = {
  snapshotHash?: string;
  recommendationsStale?: boolean;
  conditions: Conditions;
  messages: ChatMessage[];
  research: ResearchQuery | null;
};
export type ChatState = { revision: number; document: Conversation };
export type ChatRequest = {
  operationId: string;
  revision: number;
  action: "say" | "research";
  text: string;
};
export const emptyConversation = (): Conversation => ({
  conditions: {
    category: null,
    desired: [],
    avoid: [],
    budget: null,
    food: null,
  },
  messages: [],
  research: null,
});
const bad = (): never => {
  throw Error("INVALID_BARTENDER_INPUT");
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : bad();
export function parseChatRequest(value: unknown): ChatRequest {
  const v = obj(value);
  if (
    Object.keys(v).some(
      (k) => !["operationId", "revision", "action", "text"].includes(k),
    ) ||
    typeof v.operationId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      v.operationId,
    ) ||
    !Number.isSafeInteger(v.revision) ||
    (v.revision as number) < 0 ||
    !["say", "research"].includes(v.action as string) ||
    typeof v.text !== "string" ||
    v.text.length > 800 ||
    (v.action === "say" && !v.text.trim()) ||
    (v.action === "research" && v.text !== "")
  )
    return bad();
  return {
    operationId: v.operationId,
    revision: v.revision as number,
    action: v.action as ChatRequest["action"],
    text: v.text.trim(),
  };
}
export function parseConditions(
  value: unknown,
  allowed: ReadonlySet<string>,
): Conditions {
  const v = obj(value);
  const list = (x: unknown) => {
    if (
      !Array.isArray(x) ||
      x.length > 5 ||
      x.some((i) => typeof i !== "string" || !allowed.has(i)) ||
      new Set(x).size !== x.length
    )
      return bad();
    return x as string[];
  };
  if (
    v.category !== null &&
    !categories.includes(v.category as Product["category"])
  )
    return bad();
  if (
    v.budget !== null &&
    (!Number.isSafeInteger(v.budget) ||
      (v.budget as number) < 0 ||
      (v.budget as number) > 10000000)
  )
    return bad();
  if (v.food !== null && (typeof v.food !== "string" || v.food.length > 80))
    return bad();
  const desired = list(v.desired),
    avoid = list(v.avoid);
  if (desired.some((id) => avoid.includes(id))) return bad();
  return {
    category: v.category as Conditions["category"],
    desired,
    avoid,
    budget: v.budget as number | null,
    food: v.food as string | null,
  };
}
export type ModelAnswer = {
  text: string;
  conditions: Conditions;
  productIds: string[];
  research: ResearchQuery | null;
};
export function parseModelAnswer(
  value: unknown,
  products: readonly Product[],
): ModelAnswer {
  const v = obj(value),
    allowed = new Set(products.flatMap((p) => p.features.map((f) => f.id)));
  if (
    typeof v.text !== "string" ||
    !v.text.trim() ||
    v.text.length > 500 ||
    !Array.isArray(v.productIds) ||
    v.productIds.length > 3 ||
    v.productIds.some(
      (id) => typeof id !== "string" || !products.some((p) => p.id === id),
    ) ||
    new Set(v.productIds).size !== v.productIds.length
  )
    return bad();
  return {
    text: v.text.trim(),
    conditions: parseConditions(v.conditions, allowed),
    productIds: v.productIds as string[],
    research: v.research === null ? null : researchQuery(v.research),
  };
}
export function compactEvidence(snapshot: TasteSnapshot) {
  const a = analyzeTaste(snapshot);
  return {
    count: a.recordCount,
    facts: a.facts.slice(0, 12).map((f) => ({
      id: f.id,
      label: f.label,
      liked: f.positiveIds.slice(0, 3).map((id) => ({
        id,
        name: snapshot.records.find((r) => r.id === id)?.name ?? null,
      })),
      dislikedCount: f.negativeIds.length,
      neutralCount: f.neutralIds.length,
    })),
  };
}
export function candidateProducts(
  snapshot: TasteSnapshot,
  history: DrinkHistory[],
  saved: ReadonlySet<string>,
  catalog: Product[],
  message = "",
): Product[] {
  const ranked = discoverDrinks(snapshot, history, null, saved, catalog);
  const seenNames = new Set(
    history.flatMap((r) =>
      r.entered_name
        ? [`${r.category}:${normalizeProductName(r.entered_name)}`]
        : [],
    ),
  );
  return categories.flatMap((category) => {
    const eligible = catalog.filter(
      (p) =>
        p.category === category &&
        !saved.has(p.id) &&
        ![p.name, ...p.aliases].some((n) =>
          seenNames.has(`${p.category}:${normalizeProductName(n)}`),
        ),
    );
    const order = new Map(ranked.map((r, i) => [r.product.id, i]));
    const normalized = normalizeProductName(message);
    const named = (p: Product) =>
      [p.name, ...p.aliases].some((alias) => {
        const n = normalizeProductName(alias);
        return n.length >= 3 && normalized.includes(n);
      });
    return eligible
      .sort(
        (a, b) =>
          Number(named(b)) - Number(named(a)) ||
          (order.get(a.id) ?? 10000) - (order.get(b.id) ?? 10000) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 5);
  });
}
/** Source claims are rendered from server data; the model cannot author recommendation evidence. */
export function makeCards(
  ids: string[],
  conditions: Conditions,
  snapshot: TasteSnapshot,
  products: readonly Product[],
  basis?: "research",
): ChatCard[] {
  const analysis = analyzeTaste(snapshot),
    byId = new Map(snapshot.records.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const p = products.find((p) => p.id === id);
    if (
      !p ||
      (conditions.category && p.category !== conditions.category) ||
      p.features.some((f) => conditions.avoid.includes(f.id))
    )
      return [];
    const comparisons = p.features.flatMap((feature) => {
      const fact = analysis.facts.find((f) => f.id === feature.id);
      if (!fact) return [];
      const eligible = (id: string) =>
        feature.dimension === "향" || byId.get(id)?.category === p.category;
      return [
        {
          label: fact.label,
          recordIds: fact.positiveIds.filter(eligible),
          negativeIds: fact.negativeIds.filter(eligible),
        },
      ];
    });
    if (comparisons.some((f) => f.negativeIds.length)) return [];
    const evidence = comparisons
      .filter((f) => f.recordIds.length)
      .map((f) => ({ label: f.label, recordIds: f.recordIds }));
    const product = {
      ...p,
      aliases: [],
      baseAliases: [],
      description: p.description.slice(0, 300),
      features: p.features
        .slice(0, 6)
        .map((f) => ({ ...f, evidence: f.evidence.slice(0, 160) })),
      source: { ...p.source, title: p.source.title.slice(0, 150) },
    };
    return [
      {
        product,
        basis: basis ?? (evidence.length ? "records" : "today"),
        evidence,
        matched: p.features
          .filter((f) => conditions.desired.includes(f.id))
          .map((f) => f.label),
        unknown: p.features
          .filter((f) => !evidence.some((e) => e.label === f.label))
          .map((f) => f.label),
        saved: false,
      },
    ];
  });
}
export function nextConversation(
  previous: Conversation,
  text: string,
  answer: ModelAnswer,
  cards: ChatCard[],
): Conversation {
  const document: Conversation = {
    conditions: answer.conditions,
    research: answer.research,
    messages: [
      ...previous.messages,
      { role: "user" as const, text },
      { role: "assistant" as const, text: answer.text, cards },
    ].slice(-12),
  };
  while (
    document.messages.length > 2 &&
    new TextEncoder().encode(JSON.stringify(document)).length > 30000
  )
    document.messages.splice(0, 2);
  return document;
}
export function modelInput(
  previous: Conversation,
  text: string,
  snapshot: TasteSnapshot,
  products: readonly Product[],
) {
  const input = {
    conditions: previous.conditions,
    messages: previous.messages.slice(-6).map((m) => ({
      role: m.role,
      text: m.text.slice(0, 500),
      productIds: m.cards?.map((c) => c.product.id) ?? [],
    })),
    message: text,
    evidence: compactEvidence(snapshot),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      edition: p.edition,
      features: p.features
        .slice(0, 8)
        .map((f) => ({ id: f.id, label: f.label })),
    })),
  };
  if (new TextEncoder().encode(JSON.stringify(input)).length > 16000)
    throw Error("BARTENDER_CONTEXT_TOO_LARGE");
  return input;
}
/** The app and persisted state share the same bounded transport validation. */
export function parseChatState(value: unknown): ChatState {
  const v = obj(value),
    d = obj(v.document);
  if (
    !Number.isSafeInteger(v.revision) ||
    (v.revision as number) < 0 ||
    !Array.isArray(d.messages) ||
    d.messages.length > 12
  )
    return bad();
  const messages = d.messages.map((raw) => {
    const m = obj(raw);
    if (
      !["user", "assistant"].includes(m.role as string) ||
      typeof m.text !== "string" ||
      m.text.length > 800
    )
      return bad();
    const cards =
      m.cards === undefined
        ? undefined
        : (() => {
            if (!Array.isArray(m.cards) || m.cards.length > 3) return bad();
            return m.cards.map((raw) => {
              const c = obj(raw),
                p = obj(c.product),
                source = obj(p.source);
              if (
                typeof p.id !== "string" ||
                !/^[a-z0-9-]{1,160}$/.test(p.id) ||
                typeof p.name !== "string" ||
                p.name.length > 300 ||
                !categories.includes(p.category as Product["category"]) ||
                typeof p.edition !== "string" ||
                p.edition.length > 300 ||
                !Array.isArray(p.features) ||
                p.features.length > 80 ||
                typeof source.url !== "string" ||
                source.url.length > 2048 ||
                !source.url.startsWith("https://") ||
                typeof source.title !== "string" ||
                source.title.length > 500 ||
                !["records", "today", "research"].includes(c.basis as string) ||
                !Array.isArray(c.evidence) ||
                c.evidence.length > 80 ||
                !Array.isArray(c.matched) ||
                !Array.isArray(c.unknown)
              )
                return bad();
              for (const e of c.evidence) {
                const f = obj(e);
                if (
                  typeof f.label !== "string" ||
                  f.label.length > 200 ||
                  !Array.isArray(f.recordIds) ||
                  f.recordIds.length > 200 ||
                  f.recordIds.some(
                    (id) =>
                      typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id),
                  )
                )
                  return bad();
              }
              for (const labels of [c.matched, c.unknown])
                if (
                  labels.length > 80 ||
                  labels.some((s) => typeof s !== "string" || s.length > 200)
                )
                  return bad();
              // The UI never fetches source URLs itself; Linking opens only HTTPS public source links.
              const url = new URL(source.url);
              if (
                url.username ||
                url.password ||
                url.port ||
                !url.hostname.includes(".") ||
                /^\d|localhost/.test(url.hostname)
              )
                return bad();
              const { familyId, ...product } = parseCatalogDocument({
                ...p,
                familyId: p.id,
              });
              void familyId;
              return {
                product,
                basis: c.basis as ChatCard["basis"],
                evidence: c.evidence as ChatCard["evidence"],
                matched: c.matched as string[],
                unknown: c.unknown as string[],
                saved: c.saved === true,
              };
            });
          })();
    if (m.role === "user" && cards?.length) return bad();
    return {
      role: m.role as ChatMessage["role"],
      text: m.text,
      ...(cards ? { cards } : {}),
    };
  });
  // Conditions originate server-side. Bounds still apply even when old catalog facts have changed.
  const conditions = obj(d.conditions),
    allowed = new Set<string>();
  for (const field of ["desired", "avoid"]) {
    const rows = conditions[field];
    if (
      !Array.isArray(rows) ||
      rows.some((x) => typeof x !== "string" || x.length > 160)
    )
      return bad();
    for (const id of rows) allowed.add(id as string);
  }
  return {
    revision: v.revision as number,
    document: {
      ...(typeof d.snapshotHash === "string" &&
      /^[a-f0-9]{64}$/.test(d.snapshotHash)
        ? { snapshotHash: d.snapshotHash }
        : {}),
      conditions: parseConditions(conditions, allowed),
      messages,
      research: d.research === null ? null : researchQuery(d.research),
    },
  };
}

/** Prior recommendations are history, not current evidence after edits/deletion. */
export function currentConversation(
  document: Conversation,
  hash: string,
): Conversation {
  if (!document.snapshotHash || document.snapshotHash === hash) return document;
  return {
    ...document,
    recommendationsStale: true,
    messages: document.messages.map((m) => ({
      ...m,
      ...(m.cards ? { cards: [] } : {}),
    })),
  };
}
