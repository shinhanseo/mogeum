import assert from "node:assert/strict";
import test from "node:test";
import {
  activeExclusions,
  excludeMenuItem,
  menuSource,
  mergeMenuReview,
} from "../src/features/menu/review";
import {
  parseMenu,
  type MenuPhoto,
} from "../supabase/functions/_shared/menu-domain";
const photo = (
  id = "90000000-0000-4000-8000-000000000001",
  imageRevision = 1,
): MenuPhoto => ({
  id,
  imageRevision,
  width: 1200,
  height: 1600,
  engine: "apple-vision-v1",
  lines: ["글렌리벳 12년 15,000원", "기네스 드래프트 9,000원"].map(
    (text, index) => ({
      id: `${id}:${imageRevision}:${index}`,
      text,
      confidence: 0.9,
      polygon: [
        { x: 0.1, y: 0.1 + index * 0.2 },
        { x: 0.9, y: 0.1 + index * 0.2 },
        { x: 0.9, y: 0.15 + index * 0.2 },
        { x: 0.1, y: 0.15 + index * 0.2 },
      ],
    }),
  ),
});
const draft = () => {
  const p = photo();
  return {
    items: parseMenu([p]),
    photos: [{ id: p.id, imageRevision: 1, ocr: p }],
  };
};
test("excluded OCR item stays excluded on reparse, page addition and JSON restoration", () => {
  const d = draft(),
    id = d.items[0].id;
  const excluded = excludeMenuItem(d, id),
    restored = JSON.parse(JSON.stringify(excluded));
  const p2 = photo("90000000-0000-4000-8000-000000000002");
  const photos = [d.photos[0].ocr, p2];
  const result = mergeMenuReview(
    parseMenu(photos),
    restored.items,
    photos,
    restored.exclusions,
  );
  assert.ok(!result.some((i) => i.id === id));
  assert.equal(result.length, 3);
  assert.ok(
    result.some((i) => i.photoId === p2.id && i.name === "글렌리벳 12년"),
  );
  assert.deepEqual(
    activeExclusions(restored.exclusions, restored.photos),
    restored.exclusions,
  );
});
test("deleting is idempotent and does not change raw OCR or other corrections", () => {
  const d = draft(),
    raw = JSON.stringify(d.photos),
    id = d.items[0].id;
  d.items[1] = {
    ...d.items[1],
    name: "직접 수정한 메뉴",
    price: 10000,
    confirmed: true,
  };
  const excluded = excludeMenuItem(d, id),
    again = excludeMenuItem(excluded, id);
  assert.equal(again, excluded);
  assert.equal(JSON.stringify(excluded.photos), raw);
  const result = mergeMenuReview(
    parseMenu([d.photos[0].ocr]),
    excluded.items,
    [d.photos[0].ocr],
    excluded.exclusions,
  );
  assert.equal(result[0].name, "직접 수정한 메뉴");
  assert.equal(result[0].price, 10000);
  assert.equal(result[0].confirmed, true);
});
test("same-name entries with another price, page or serving are not removed by name", () => {
  const d = draft(),
    first = d.items[0];
  d.items.push({
    ...first,
    id: `${first.id}:bottle`,
    price: 150000,
    serving: "bottle",
  });
  const excluded = excludeMenuItem(d, first.id);
  assert.equal(excluded.items.length, 2);
  assert.ok(excluded.items.some((i) => i.serving === "bottle"));
});
test("retaking/deleting a page removes its exclusion without removing exclusions on another page", () => {
  const d = draft(),
    p2 = photo("90000000-0000-4000-8000-000000000002");
  d.photos.push({ id: p2.id, imageRevision: 1, ocr: p2 });
  d.items.push(...parseMenu([p2]));
  let excluded = excludeMenuItem(d, d.items[0].id);
  excluded = excludeMenuItem(excluded, d.items[2].id);
  const replacement = photo(d.photos[0].id, 2);
  const remaining = activeExclusions(excluded.exclusions, [
    { id: replacement.id, imageRevision: 2, ocr: replacement },
    d.photos[1],
  ]);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].photoId, p2.id);
  assert.equal(activeExclusions(excluded.exclusions, [d.photos[1]]).length, 1);
  assert.equal(
    mergeMenuReview(
      parseMenu([replacement]),
      [],
      [replacement],
      excluded.exclusions,
    ).length,
    2,
  );
});
test("reused line IDs with changed OCR text cannot hide a new menu", () => {
  const d = draft(),
    excluded = excludeMenuItem(d, d.items[0].id),
    changed = structuredClone(d.photos[0].ocr);
  changed.lines[0].text = "화요 25 25,000원";
  assert.notEqual(
    menuSource(d.items[0], [d.photos[0].ocr]),
    menuSource(d.items[0], [changed]),
  );
  assert.equal(
    activeExclusions(excluded.exclusions, [
      { id: changed.id, imageRevision: 1, ocr: changed },
    ]).length,
    0,
  );
  assert.equal(
    mergeMenuReview(parseMenu([changed]), [], [changed], excluded.exclusions)
      .length,
    2,
  );
});
test("a temporary OCR failure preserves exclusion intent until retry resolves its source", () => {
  const d = draft(),
    excluded = excludeMenuItem(d, d.items[0].id);
  assert.equal(
    activeExclusions(excluded.exclusions, [
      { id: d.photos[0].id, imageRevision: 1, ocr: null },
    ]).length,
    1,
  );
  assert.equal(activeExclusions(excluded.exclusions, d.photos).length, 1);
});
test("manually entered deleted items do not reappear or need OCR exclusion; old and corrupt drafts remain readable", () => {
  const d = draft(),
    manual = {
      ...d.items[0],
      id: `${d.photos[0].id}:1:manual:one`,
      lineIds: [],
    };
  d.items.push(manual);
  const deleted = excludeMenuItem(d, manual.id);
  assert.deepEqual(deleted.exclusions, []);
  assert.ok(
    !mergeMenuReview(
      parseMenu([d.photos[0].ocr]),
      deleted.items,
      [d.photos[0].ocr],
      deleted.exclusions,
    ).some((i) => i.id === manual.id),
  );
  assert.deepEqual(activeExclusions(undefined, d.photos), []);
  assert.deepEqual(
    activeExclusions([null, { itemId: "injected" }], d.photos),
    [],
  );
  const excluded = excludeMenuItem(d, d.items[0].id);
  assert.equal(
    activeExclusions(
      [...excluded.exclusions!, ...excluded.exclusions!],
      d.photos,
    ).length,
    1,
  );
});

test("missing raw source cannot silently claim a durable exclusion", () => {
  const d = draft();
  const broken = { ...d, photos: d.photos.map((p) => ({ ...p, ocr: null })) };
  assert.throws(
    () => excludeMenuItem(broken, d.items[0].id),
    /MENU_SOURCE_MISSING/,
  );
  assert.equal(broken.items.length, 2);
});
