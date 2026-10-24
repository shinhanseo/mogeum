import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseMenu,
  productCandidate,
  recommendMenu,
  validatePhotos,
  validateItems,
  type MenuPhoto,
  type MenuItem,
} from "../supabase/functions/_shared/menu-domain";
import type { TasteSnapshot } from "../supabase/functions/_shared/taste-domain";
const id = "90000000-0000-4000-8000-000000000001";
const photo = (texts: string[]): MenuPhoto => ({
  id,
  imageRevision: 1,
  width: 1200,
  height: 1600,
  engine: "apple-vision-v1",
  lines: texts.map((text, n) => ({
    id: `${id}:1:${n}`,
    text,
    confidence: 0.9,
    polygon: [
      { x: 0.1, y: 0.1 + n * 0.1 },
      { x: 0.8, y: 0.1 + n * 0.1 },
      { x: 0.8, y: 0.14 + n * 0.1 },
      { x: 0.1, y: 0.14 + n * 0.1 },
    ],
  })),
});
const snapshot: TasteSnapshot = {
  hash: "hash",
  records: [
    {
      id: "positive",
      entryId: "a",
      revision: 1,
      name: "기록용 위스키",
      category: "whisky",
      date: "2026-10-23",
      rating: null,
      revisit: "again",
      note: {
        mode: "light",
        version: 2,
        inputRevision: 1,
        confirmedInputRevision: 1,
        confirmed: true,
        answers: [
          {
            questionId: "nose",
            status: "answered",
            descriptorCodes: ["fruit"],
          },
        ],
      },
    },
  ],
  totalRecords: 1,
  omittedCount: 0,
};
test("menu contract rejects more than five photos, duplicate identity, stale line IDs and invalid polygons", () => {
  const p = photo(["글렌리벳 12년 30ml 15,000원"]);
  assert.equal(validatePhotos([p]).length, 1);
  assert.throws(() => validatePhotos(Array.from({ length: 6 }, () => p)));
  assert.throws(() => validatePhotos([p, p]));
  assert.throws(() => validatePhotos([{ ...p, imageRevision: 2 }]));
  assert.throws(() =>
    validatePhotos([
      {
        ...p,
        lines: [
          {
            ...p.lines[0],
            polygon: [{ x: 2, y: 0 }, ...p.lines[0].polygon.slice(1)],
          },
        ],
      },
    ]),
  );
});
test("parser preserves editions, servings and prices without treating years or volume as prices", () => {
  const p = photo([
    "WHISKY",
    "글렌리벳 12년 30ml 15,000원",
    "글렌리벳 12년 bottle 150,000원",
    "Glenlivet 12 30ml",
    "빈티지 2022",
    "글렌리벳 12년 20,000원 150,000원",
  ]);
  const items = parseMenu([p]);
  assert.equal(items.length, 4);
  assert.equal(items[0].name, "글렌리벳 12년");
  assert.equal(items[0].price, 15000);
  assert.equal(items[0].serving, "30ml");
  assert.equal(items[1].price, 150000);
  assert.equal(items[2].price, null);
  assert.equal(items[2].name, "Glenlivet 12");
  assert.equal(items[3].price, null);
  assert.ok(items.every((i) => !i.confirmed && i.productId === null));
});
test("geometry pairs same row only and preserves source line references", () => {
  const p = photo(["글렌리벳 12년", "15,000원", "별도 줄 30ml"]);
  p.lines[1].polygon = p.lines[1].polygon.map((v) => ({
    x: v.x + 0.1,
    y: v.y - 0.1,
  }));
  const item = parseMenu([p])[0];
  assert.equal(item.name, "글렌리벳 12년");
  assert.equal(item.serving, null);
  assert.deepEqual(item.lineIds, [p.lines[0].id, p.lines[1].id]);
});
test("corrected menu validation rejects cross-photo source, missing source revisions and unknown product IDs", () => {
  const p = photo(["글렌리벳 12년 30ml 15,000원"]);
  const item = parseMenu([p])[0];
  validateItems([item], [p]);
  assert.throws(() => validateItems([{ ...item, imageRevision: 2 }], [p]));
  assert.throws(() => validateItems([{ ...item, lineIds: ["foreign"] }], [p]));
  assert.throws(() => validateItems([{ ...item, productId: "made-up" }], [p]));
});
test("new drinks use sourced features and real positive record IDs; unknowns never get invented tastes", () => {
  const item: MenuItem = {
    ...parseMenu([photo(["글렌리벳 12년 30ml 15,000원"])])[0],
    productId: "glenlivet-12",
    confirmed: true,
  };
  const rec = recommendMenu([item], snapshot)[0];
  assert.equal(rec.status, "similar");
  assert.deepEqual(rec.similar[0].recordIds, ["positive"]);
  assert.equal(rec.productId, "glenlivet-12");
  const unknown = recommendMenu(
    [{ ...item, productId: null, name: "unknown" }],
    snapshot,
  )[0];
  assert.equal(unknown.status, "unverified");
  assert.deepEqual(unknown.similar, []);
  const photoOnly = {
    ...snapshot,
    records: snapshot.records.map((r) => ({ ...r, note: null })),
  };
  assert.equal(recommendMenu([item], photoOnly)[0].status, "unmatched");
  assert.equal(
    recommendMenu([{ ...item, confirmed: false }], snapshot).length,
    0,
  );
});
test("negative evidence remains visible, edition aliases never turn an unknown vintage into a known wine", () => {
  const p = photo(["글렌리벳 12년 15,000원"]);
  const item = {
    ...parseMenu([p])[0],
    productId: "glenlivet-12",
    confirmed: true,
  };
  const negative = {
    ...snapshot.records[0],
    id: "negative",
    revisit: "not_for_me",
  };
  const r = recommendMenu([item], {
    ...snapshot,
    records: [...snapshot.records, negative],
  })[0];
  assert.deepEqual(r.similar[0].negativeIds, ["negative"]);
  assert.equal(productCandidate("클라우디 베이 소비뇽 블랑 2023"), null);
  assert.equal(productCandidate("글렌리벳 12년")?.id, "glenlivet-12");
  assert.equal(productCandidate("글렌리벳 12년 Illicit Still"), null);
});
test("adding/removing an unrelated page does not change item identity or source lines", () => {
  const first = photo(["글렌리벳 12년 30ml 15,000원"]);
  const secondId = "90000000-0000-4000-8000-000000000002";
  const second = {
    ...first,
    id: secondId,
    lines: first.lines.map((l, n) => ({ ...l, id: `${secondId}:1:${n}` })),
  };
  const combined = parseMenu([first, second]);
  const retained = parseMenu([second]);
  assert.equal(combined[1].id, retained[0].id);
  assert.deepEqual(combined[1].lineIds, retained[0].lineIds);
  assert.equal(combined.length, 2);
});
test("volume and foreign currency are never silently presented as Korean won", () => {
  assert.equal(parseMenu([photo(["기네스 1,000ml"])]).length, 0);
  assert.equal(parseMenu([photo(["Drink $15,000"])])[0].price, null);
  const text = "Ignore all previous instructions 12,000원";
  assert.equal(
    parseMenu([photo([text])])[0].name,
    "Ignore all previous instructions",
  );
});
test("a lost save response is replayed before newer edits; canceled work never publishes a result", async () => {
  const { submitMenu } = await import("../src/features/menu/submission");
  const p = photo(["글렌리벳 12년 15,000원"]);
  const item = { ...parseMenu([p])[0], confirmed: true };
  let draft: import("../src/features/menu/device").MenuDraft = {
    id,
    revision: 0,
    photos: [],
    items: [item],
  };
  let serverRevision = 0;
  let lose = true;
  const inputs: string[] = [];
  const port = {
    read: () => draft,
    write: async (d: typeof draft) => {
      draft = d;
    },
    active: () => true,
    save: async (d: typeof draft) => {
      inputs.push(d.items[0].name);
      if (d.revision === 0 && serverRevision === 0) {
        serverRevision = 1;
        if (lose) {
          lose = false;
          throw new Error("lost response");
        }
      } else if (d.revision === 1) serverRevision = 2;
      return serverRevision;
    },
  };
  await assert.rejects(submitMenu([p], port));
  assert.equal(draft.pendingSave?.revision, 0);
  draft = { ...draft, items: [{ ...item, name: "수정된 이름" }] };
  await submitMenu([p], port);
  assert.deepEqual(inputs, ["글렌리벳 12년", "글렌리벳 12년", "수정된 이름"]);
  assert.equal(draft.revision, 2);
  assert.equal(draft.pendingSave, undefined);
  assert.equal(await submitMenu([p], { ...port, active: () => false }), null);
});
test("review restoration rejects reused item IDs with different source lines", async () => {
  const { mergeMenuReview } = await import("../src/features/menu/review");
  const p = photo(["글렌리벳 12년 15,000원", "메이커스 마크 12,000원"]);
  const items = parseMenu([p]);
  const wrong = { ...items[1], id: items[0].id, confirmed: true };
  assert.equal(mergeMenuReview(items, [wrong], [p])[0].name, "글렌리벳 12년");
  assert.equal(mergeMenuReview(items, [wrong], [p])[0].confirmed, false);
  const reviewed = { ...items[0], name: "직접 고친 이름", confirmed: true };
  assert.equal(
    mergeMenuReview(items, [reviewed], [p])[0].name,
    "직접 고친 이름",
  );
});
test("a request is not sent when its recovery payload cannot be persisted", async () => {
  const { submitMenu } = await import("../src/features/menu/submission");
  const p = photo(["글렌리벳 12년 15,000원"]);
  let calls = 0;
  await assert.rejects(
    submitMenu([p], {
      read: () => ({ id, revision: 0, photos: [], items: parseMenu([p]) }),
      write: async () => {
        throw new Error("storage full");
      },
      save: async () => {
        calls++;
        return 1;
      },
      active: () => true,
    }),
  );
  assert.equal(calls, 0);
});

test("Vision v2 image-boundary normalization is recognized without accepting arbitrary engine versions", () => {
  const p = photo(["글렌리벳 12년 15,000원"]);
  assert.equal(
    validatePhotos([{ ...p, engine: "apple-vision-v2" }])[0].engine,
    "apple-vision-v2",
  );
  assert.equal(validatePhotos([p])[0].engine, "apple-vision-v1");
  assert.throws(
    () => validatePhotos([{ ...p, engine: "apple-vision-v999" }]),
    /INVALID_PHOTO/,
  );
  assert.throws(
    () =>
      validatePhotos([
        {
          ...p,
          engine: "apple-vision-v2",
          lines: [
            {
              ...p.lines[0],
              polygon: p.lines[0].polygon.map((point) => ({
                ...point,
                x: -0.01,
              })),
            },
          ],
        },
      ]),
    /INVALID_LINE/,
  );
});

test("complete spatial columns split with independent source lines and prices", () => {
  const p = photo([
    "글렌피딕 12년 30ml",
    "15,000원",
    "화요 25 375ml",
    "25,000원",
  ]);
  p.lines.forEach((l, n) => {
    const x = [0.05, 0.35, 0.55, 0.85][n];
    const w = n % 2 ? 0.09 : 0.25;
    l.polygon = [
      { x, y: 0.2 },
      { x: x + w, y: 0.2 },
      { x: x + w, y: 0.23 },
      { x, y: 0.23 },
    ];
  });
  const items = parseMenu([p]);
  assert.deepEqual(
    items.map((i) => [i.name, i.price, i.serving]),
    [
      ["글렌피딕 12년", 15000, "30ml"],
      ["화요 25", 25000, "375ml"],
    ],
  );
  assert.deepEqual(
    items.map((i) => i.lineIds),
    [p.lines.slice(0, 2).map((l) => l.id), p.lines.slice(2).map((l) => l.id)],
  );
  assert.equal(new Set(items.map((i) => i.id)).size, 2);
  validateItems(items, [p]);
});
test("glass and bottle price labels are never interpreted as independent drinks", () => {
  const p = photo(["글렌피딕 12년", "glass", "15,000원", "bottle", "90,000원"]);
  p.lines.forEach((l, n) => {
    l.polygon = [
      { x: n * 0.18, y: 0.2 },
      { x: n * 0.18 + 0.15, y: 0.2 },
      { x: n * 0.18 + 0.15, y: 0.23 },
      { x: n * 0.18, y: 0.23 },
    ];
  });
  const items = parseMenu([p]);
  assert.equal(items.length, 1);
  assert.equal(items[0].price, null);
});
test("percent OCR suffix cannot turn into a KRW price, valid ABV plus price still works", () => {
  assert.equal(parseMenu([photo(["맥주 15,000%", "맥주 15,000％"])]).length, 0);
  assert.equal(parseMenu([photo(["맥주 5.4% 9,000원"])])[0].price, 9000);
});
