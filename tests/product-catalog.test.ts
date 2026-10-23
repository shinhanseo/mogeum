import assert from "node:assert/strict";
import test from "node:test";
import {
  products,
  productCandidates,
  productCandidate,
  normalizeProductName,
} from "../supabase/functions/_shared/product-catalog";
import {
  recommendMenu,
  validateItems,
  type MenuItem,
  type MenuPhoto,
} from "../supabase/functions/_shared/menu-domain";
import {
  analyzeTaste,
  type TasteSnapshot,
  type TasteRecord,
} from "../supabase/functions/_shared/taste-domain";
import { featureCatalog } from "../supabase/functions/_shared/taste-features";
const record = (category: string, code: string): TasteRecord => ({
  id: category,
  entryId: category,
  revision: 1,
  name: "내 기록",
  category,
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
      { questionId: "nose", status: "answered", descriptorCodes: [code] },
    ],
  },
});
const snapshot = (records: TasteRecord[]): TasteSnapshot => ({
  hash: "fixture",
  records,
  totalRecords: records.length,
  omittedCount: 0,
});
const item = (name: string, productId: string | null): MenuItem => ({
  id: "90000000-0000-4000-8000-000000000001:1:manual-one",
  photoId: "90000000-0000-4000-8000-000000000001",
  imageRevision: 1,
  lineIds: [],
  name,
  productId,
  price: 10000,
  serving: null,
  confirmed: true,
});
test("32 edition-scoped products have usable facts, provenance and collision-free exact aliases", () => {
  assert.equal(products.length, 32);
  const aliases = new Map<string, string>();
  const known = new Set<string>();
  for (const [category, modes] of Object.entries(featureCatalog))
    for (const [mode, fields] of Object.entries(modes))
      for (const f of fields)
        for (const o of f.options ?? []) {
          const answers = [
            { questionId: f.id, status: "answered", descriptorCodes: [o.code] },
            ...("when" in f && f.when
              ? [
                  {
                    questionId: f.when.field,
                    status: "answered",
                    descriptorCodes: [f.when.includes],
                  },
                ]
              : []),
          ];
          for (const fact of analyzeTaste(
            snapshot([
              {
                ...record(category, ""),
                note: { ...record(category, "").note!, mode, answers },
              },
            ]),
          ).facts)
            known.add(fact.id);
        }
  for (const category of ["whisky", "wine", "beer", "traditional"])
    assert.equal(products.filter((p) => p.category === category).length, 8);
  for (const p of products) {
    assert.ok(p.edition && p.source.title && p.description);
    assert.equal(new URL(p.source.url).protocol, "https:");
    assert.equal(p.source.checkedAt, "2026-10-23");
    assert.ok(p.features.length, p.id);
    for (const f of p.features) {
      assert.ok(known.has(f.id), `${p.id}: ${f.id}`);
      assert.ok(f.evidence);
    }
    for (const a of p.aliases) {
      const n = normalizeProductName(a);
      assert.ok(!aliases.has(n) || aliases.get(n) === p.id, `collision ${a}`);
      aliases.set(n, p.id);
      assert.ok(productCandidates(a).some((c) => c.id === p.id));
    }
  }
});
test("wine without vintage offers explicit choices; unsupported vintages and variants stay unknown", () => {
  assert.deepEqual(
    productCandidates("Cloudy Bay Sauvignon Blanc").map((p) => p.edition),
    ["2022", "2024"],
  );
  assert.equal(productCandidate("Cloudy Bay Sauvignon Blanc"), null);
  assert.equal(
    productCandidate("Cloudy Bay Sauvignon Blanc 2024")?.id,
    "cloudy-bay-sb-2024",
  );
  assert.equal(productCandidate("MOËT IMPÉRIAL")?.id, "moet-imperial-brut-nv");
  for (const name of [
    "Cloudy Bay Sauvignon Blanc 2023",
    "Cloudy Bay Sauvignon Blanc ２０２３",
    "Moet Imperial 2022",
    "하우스 와인",
    "막걸리",
    "화요 17",
    "나루 6.5",
    "나루 1.15",
    "화요 2.5",
    "Glenfiddich 1.2",
    "Heineken 0.0",
    "Laphroaig 10 Cask Strength",
    "Punk IPA 6%",
    "Hoegaarden Rosée",
  ])
    assert.deepEqual(productCandidates(name), [], name);
  const photo: MenuPhoto = {
    id: item("", null).photoId,
    imageRevision: 1,
    width: 100,
    height: 100,
    engine: "manual",
    lines: [],
  };
  assert.throws(() => validateItems([item("화요 25", "hwayo-41")], [photo]));
  assert.throws(() =>
    validateItems(
      [item("Cloudy Bay Sauvignon Blanc 2023", "cloudy-bay-sb-2022")],
      [photo],
    ),
  );
  assert.equal(
    validateItems(
      [item("Cloudy Bay Sauvignon Blanc", "cloudy-bay-sb-2024")],
      [photo],
    ).length,
    1,
  );
});
test("all four categories connect real question codes to sourced product facts and evidence IDs", () => {
  for (const [category, code, productId] of [
    ["whisky", "fruit", "glenfiddich-12"],
    ["wine", "citrus", "cloudy-bay-sb-2024"],
    ["beer", "citrus", "sierra-nevada-pale-ale"],
    ["traditional", "rice_grain", "hwayo-25"],
  ]) {
    const p = products.find((p) => p.id === productId)!;
    const result = recommendMenu(
      [item(p.name, p.id)],
      snapshot([record(category, code)]),
    )[0];
    assert.equal(result.status, "similar", category);
    assert.ok(result.similar.every((f) => f.recordIds.includes(category)));
    assert.equal(result.score, 1);
  }
  const spoof = recommendMenu(
    [item("하우스 와인", "cloudy-bay-sb-2024")],
    snapshot([record("wine", "citrus")]),
  )[0];
  assert.equal(spoof.status, "unverified");
  assert.deepEqual(spoof.similar, []);
});
