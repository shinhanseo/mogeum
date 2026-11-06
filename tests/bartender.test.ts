import test from "node:test";
import assert from "node:assert/strict";
import {
  candidateProducts,
  currentConversation,
  compactEvidence,
  emptyConversation,
  makeCards,
  modelInput,
  nextConversation,
  parseChatRequest,
  parseChatState,
  parseModelAnswer,
} from "../supabase/functions/_shared/bartender-domain";
import { products } from "../supabase/functions/_shared/product-catalog";
import {
  bartenderHandler,
  type BartenderPorts,
} from "../supabase/functions/_shared/bartender-handler";
import type { TasteSnapshot } from "../supabase/functions/_shared/taste-domain";
const empty: TasteSnapshot = {
  hash: "a".repeat(64),
  records: [],
  totalRecords: 0,
  omittedCount: 0,
};
const id = "10000000-0000-4000-8000-000000000001";
const request = {
  operationId: id,
  revision: 0,
  action: "say",
  text: "과일 향 나는 위스키를 추천해줘",
};
const answer = {
  text: "이 한 잔부터 살펴볼까요?",
  conditions: {
    category: "whisky",
    desired: ["향:과일 향"],
    avoid: [],
    budget: null,
    food: null,
  },
  productIds: ["glenlivet-12"],
  research: null,
};
const positive = {
  id,
  entryId: "10000000-0000-4000-8000-000000000002",
  revision: 1,
  category: "whisky",
  name: "기록",
  date: "2026-11-05",
  revisit: "again",
  rating: null,
  note: {
    mode: "light",
    version: 2,
    inputRevision: 1,
    confirmedInputRevision: 1,
    confirmed: true,
    answers: [
      { questionId: "nose", status: "answered", descriptorCodes: ["fruit"] },
    ],
  },
};
test("chat request rejects identity injection, empty/oversize text and invalid research actions", () => {
  assert.equal(parseChatRequest(request).text, request.text);
  for (const input of [
    { ...request, userId: id },
    { ...request, text: "" },
    { ...request, text: "x".repeat(801) },
    { ...request, revision: -1 },
    { ...request, action: "research", text: "override query" },
  ])
    assert.throws(() => parseChatRequest(input));
});
test("candidate selection excludes saved and previously named drinks; balances four categories", () => {
  const result = candidateProducts(
    empty,
    [
      {
        entered_name: "글렌리벳 12년",
        category: "whisky",
        vintage_status: null,
        vintage_year: null,
      },
    ],
    new Set(["makers-mark"]),
    products,
  );
  assert(!result.some((p) => ["glenlivet-12", "makers-mark"].includes(p.id)));
  assert.deepEqual(
    new Set(result.map((p) => p.category)),
    new Set(["whisky", "wine", "beer", "traditional"]),
  );
  assert(result.length <= 20);
});
test("only confirmed sensory notes support personal evidence; today and records stay separate", () => {
  const selected = parseModelAnswer(answer, products);
  const photo = {
    ...empty,
    records: [{ ...positive, note: null }],
    totalRecords: 1,
  };
  assert.equal(compactEvidence(photo).count, 0);
  const fresh = makeCards(
    selected.productIds,
    selected.conditions,
    photo,
    products,
  )[0];
  assert.equal(fresh.basis, "today");
  assert.deepEqual(fresh.evidence, []);
  const snapshot = { ...empty, records: [positive], totalRecords: 1 };
  const card = makeCards(
    selected.productIds,
    selected.conditions,
    snapshot,
    products,
  )[0];
  assert.equal(card.basis, "records");
  assert.deepEqual(card.evidence[0].recordIds, [id]);
  assert.deepEqual(
    makeCards(
      selected.productIds,
      { ...selected.conditions, avoid: ["향:과일 향"], desired: [] },
      snapshot,
      products,
    ),
    [],
  );
  const negative = {
    ...empty,
    records: [{ ...positive, revisit: "not_for_me" }],
    totalRecords: 1,
  };
  assert.deepEqual(
    makeCards(selected.productIds, selected.conditions, negative, products),
    [],
  );
});
test("provider cannot inject unknown product IDs, taste labels, conflicting conditions or oversized replies", () => {
  for (const output of [
    { ...answer, productIds: ["imaginary"] },
    { ...answer, text: "x".repeat(501) },
    { ...answer, conditions: { ...answer.conditions, desired: ["made up"] } },
    { ...answer, conditions: { ...answer.conditions, avoid: ["향:과일 향"] } },
  ])
    assert.throws(() => parseModelAnswer(output, products));
});
test("conversation memory is bounded, carries only short text into the next model call", () => {
  let doc = emptyConversation();
  const parsed = parseModelAnswer(answer, products);
  for (let i = 0; i < 20; i++)
    doc = nextConversation(
      doc,
      `message ${i}`,
      parsed,
      makeCards(parsed.productIds, parsed.conditions, empty, products),
    );
  assert.equal(doc.messages.length, 12);
  const input = modelInput(
    doc,
    "next",
    empty,
    candidateProducts(empty, [], new Set(), products),
  );
  assert.equal(input.messages.length, 6);
  assert(!JSON.stringify(input.messages).includes("https://"));
  assert.deepEqual(
    parseChatState({ revision: 20, document: doc }).document,
    doc,
  );
  assert.throws(() =>
    parseChatState({
      revision: 1,
      document: {
        ...doc,
        messages: [
          {
            role: "assistant",
            text: "bad",
            cards: [{ product: { source: { url: "http://localhost" } } }],
          },
        ],
      },
    }),
  );
});
function harness() {
  let calls = 0,
    authenticated = 0,
    finishes = 0;
  let reservation = "acquired";
  let previous = emptyConversation();
  let cached: unknown;
  const ports: BartenderPorts = {
    authenticate: async () => {
      authenticated++;
      return { id };
    },
    configured: () => true,
    begin: async () =>
      reservation === "cached"
        ? { state: "cached", result: cached }
        : { state: reservation, document: previous },
    finish: async (_o, _p, _h, _d, result) => {
      finishes++;
      cached = result;
      return true;
    },
    context: async () => ({
      snapshot: empty,
      catalog: products,
      history: [],
      saved: new Set(),
    }),
    converse: async () => {
      calls++;
      return { output: answer, inputTokens: 2000, outputTokens: 300 };
    },
    research: async () => ({ product: null, state: "unavailable" }),
  };
  return {
    ports,
    handler: bartenderHandler(ports),
    counts: () => ({ calls, authenticated, finishes }),
    setReservation: (state: string) => {
      reservation = state;
    },
    setPrevious: (value: typeof previous) => {
      previous = value;
    },
  };
}
const post = (value: unknown = request, token = true) =>
  new Request("https://example.test/chat", {
    method: "POST",
    headers: token ? { Authorization: "Bearer test" } : {},
    body: JSON.stringify(value),
  });
test("handler authenticates, validates before provider, and cached retry never calls Gemini again", async () => {
  const h = harness();
  assert.equal((await h.handler(post(request, false))).status, 401);
  assert.equal((await h.handler(post({ ...request, userId: id }))).status, 400);
  assert.equal(h.counts().calls, 0);
  const response = await h.handler(post());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.revision, 1);
  parseChatState(body);
  assert.equal(h.counts().calls, 1);
  h.setReservation("cached");
  assert.deepEqual(await (await h.handler(post())).json(), body);
  assert.equal(h.counts().calls, 1);
});
test("limits, conflict and running requests cannot reach provider", async () => {
  for (const state of [
    "running",
    "daily-limit",
    "global-limit",
    "stale",
    "conflict",
    "failed",
  ]) {
    const h = harness();
    h.setReservation(state);
    assert.equal((await h.handler(post())).status, 409);
    assert.equal(h.counts().calls, 0);
  }
});
test("provider failure closes the lease without silently generating a fake response", async () => {
  const h = harness();
  h.ports.converse = async () => {
    throw Error("secret remote error");
  };
  const response = await h.handler(post());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: "BARTENDER_UNAVAILABLE" });
  assert.equal(h.counts().finishes, 1);
});
test("research must be explicitly requested from server-stored target, never client-supplied query", async () => {
  const h = harness();
  let searched = 0;
  h.ports.research = async (q) => {
    searched++;
    assert.equal(q.name, "제품 후보");
    return { product: null, state: "unresolved" };
  };
  h.setPrevious({
    ...emptyConversation(),
    research: { name: "제품 후보", category: "beer", edition: null },
  });
  const response = await h.handler(
    post({ ...request, action: "research", text: "" }),
  );
  assert.equal(response.status, 200);
  assert.equal(searched, 1);
  assert.equal(h.counts().calls, 0);
  assert.equal((await response.json()).document.research, null);
});

test("record changes hide stale recommendation evidence, while old words remain as conversation history", () => {
  const parsed = parseModelAnswer(answer, products);
  const doc = {
    ...nextConversation(
      emptyConversation(),
      "recommend",
      parsed,
      makeCards(parsed.productIds, parsed.conditions, empty, products),
    ),
    snapshotHash: "a".repeat(64),
  };
  const hidden = currentConversation(doc, "b".repeat(64));
  assert.equal(hidden.recommendationsStale, true);
  assert.equal(hidden.messages.at(-1)?.cards?.length, 0);
  assert.equal(hidden.messages.at(-1)?.text, doc.messages.at(-1)?.text);
  assert.equal(currentConversation(doc, "a".repeat(64)), doc);
});

test("ordinary conversation suppresses product suggestions even after a recommendation", async () => {
  const { showDrinkRefinements } =
    await import("../supabase/functions/_shared/bartender-domain");
  const parsed = parseModelAnswer(answer, products);
  const recommended = nextConversation(
    emptyConversation(),
    "술 골라줘",
    parsed,
    makeCards(parsed.productIds, parsed.conditions, empty, products),
  );
  assert.equal(showDrinkRefinements(recommended), true);
  const talk = parseModelAnswer(
    { ...answer, intent: "conversation", text: "오늘 어떤 일이 있었어요?" },
    products,
  );
  assert.deepEqual(talk.productIds, []);
  assert.equal(talk.research, null);
  const conversation = nextConversation(
    recommended,
    "그냥 이야기하고 싶어",
    talk,
    [],
  );
  assert.equal(showDrinkRefinements(conversation), false);
  assert.equal(
    showDrinkRefinements({ ...recommended, recommendationsStale: true }),
    false,
  );
  const h = harness();
  h.setPrevious(recommended);
  h.ports.converse = async () => ({
    output: {
      ...answer,
      intent: "conversation",
      conditions: { ...answer.conditions, category: "beer" },
      text: "편하게 이야기해요.",
    },
    inputTokens: 100,
    outputTokens: 50,
  });
  const result = await (await h.handler(post())).json();
  assert.equal(result.document.conditions.category, "whisky");
  assert.deepEqual(result.document.messages.at(-1).cards, []);
});

test("dark beer and ABV requirements require explicit product evidence", async () => {
  const { matchesBeerRequirements } =
    await import("../supabase/functions/_shared/bartender-domain");
  const base = {
    ...products[0],
    category: "beer" as const,
    name: "합성 골든 에일",
    edition: "Original · 8.5%",
    description: "골든 에일",
    features: [],
  };
  const conditions = {
    ...emptyConversation().conditions,
    category: "beer" as const,
    beerStyle: "dark" as const,
    minimumAbv: 8,
  };
  assert.equal(matchesBeerRequirements(base, conditions), false);
  assert.equal(
    matchesBeerRequirements(
      { ...base, name: "합성 스타우트", description: "Imperial stout" },
      conditions,
    ),
    true,
  );
  assert.equal(
    matchesBeerRequirements(
      { ...base, name: "합성 스타우트", edition: "4.2%" },
      conditions,
    ),
    false,
  );
  assert.equal(
    matchesBeerRequirements(
      { ...base, name: "합성 스타우트", edition: "기본판" },
      conditions,
    ),
    false,
  );
  assert.deepEqual(makeCards([base.id], conditions, empty, [base]), []);
});
test("pairing replies cannot switch the drink and retain the discussed product context", () => {
  const parsed = parseModelAnswer(answer, products),
    cards = makeCards(parsed.productIds, parsed.conditions, empty, products);
  const previous = nextConversation(
    emptyConversation(),
    "술 추천해줘",
    parsed,
    cards,
  );
  const pairing = parseModelAnswer(
    { ...answer, intent: "pairing", text: "감자튀김을 곁들여보면 어때요?" },
    products,
  );
  assert.deepEqual(pairing.productIds, []);
  assert.equal(pairing.research, null);
  const conversation = nextConversation(
    previous,
    "안주 뭐 먹을까?",
    pairing,
    [],
  );
  const input = modelInput(
    conversation,
    "너가 골라줘",
    empty,
    products.slice(0, 5),
  );
  assert.equal(input.topic, "pairing");
  assert.equal(input.discussedDrink[0].name, "글렌리벳 12년");
});

test("price questions are information and cannot silently replace a recommendation", async () => {
  const parsed = parseModelAnswer(
    { ...answer, intent: "information" },
    products,
  );
  assert.deepEqual(parsed.productIds, []);
  assert.equal(parsed.research, null);
  const h = harness();
  const previous = nextConversation(
    emptyConversation(),
    "하나 골라줘",
    parseModelAnswer(answer, products),
    makeCards(
      ["glenlivet-12"],
      parseModelAnswer(answer, products).conditions,
      empty,
      products,
    ),
  );
  h.setPrevious(previous);
  h.ports.converse = async () => ({
    output: {
      ...answer,
      intent: "information",
      conditions: { ...answer.conditions, budget: 30000 },
    },
    inputTokens: 100,
    outputTokens: 50,
  });
  const result = await (
    await h.handler(post({ ...request, text: "이거 3만원에 살 수 있어?" }))
  ).json();
  assert.equal(result.document.topic, "information");
  assert.deepEqual(result.document.messages.at(-1).cards, []);
  assert.equal(result.document.conditions.budget, null);
});
test("explicit dislike vocabulary survives a shortlist with no matching feature", () => {
  const dry = parseModelAnswer(
    {
      ...answer,
      conditions: {
        ...answer.conditions,
        desired: [],
        avoid: ["맛:달콤한 맛"],
      },
    },
    [products[0]],
  );
  assert.deepEqual(dry.conditions.avoid, ["맛:달콤한 맛"]);
  const doc = nextConversation(
    emptyConversation(),
    "흑맥주 8퍼 이상",
    parseModelAnswer(answer, products),
    [],
  );
  assert.equal(
    modelInput(doc, "그거랑 안주?", empty, [products[0]])
      .latestDrinkRequestUnresolved,
    true,
  );
});

test("explicit percentage is kept exactly instead of rounded to a product ABV", async () => {
  const { exactUserConditions } =
    await import("../supabase/functions/_shared/bartender-domain");
  const conditions = {
    ...emptyConversation().conditions,
    category: "beer" as const,
    minimumAbv: 8.5,
  };
  assert.equal(exactUserConditions(conditions, "8퍼 이상").minimumAbv, 8);
  assert.equal(exactUserConditions(conditions, "7.5% 이상").minimumAbv, 7.5);
  assert.equal(exactUserConditions(conditions, "도수 높은 거").minimumAbv, 8.5);
});

test("unresolved drink stays unresolved while food discussion continues", () => {
  const parsed = parseModelAnswer(answer, products);
  const unresolved = nextConversation(
    emptyConversation(),
    "흑맥주 8% 이상",
    parsed,
    [],
  );
  const food = parseModelAnswer(
    { ...answer, intent: "pairing", text: "구운 소시지 어떠세요?" },
    products,
  );
  const follow = nextConversation(unresolved, "그거랑 안주?", food, []);
  assert.equal(
    modelInput(follow, "네가 골라줘", empty, [products[0]])
      .latestDrinkRequestUnresolved,
    true,
  );
});
