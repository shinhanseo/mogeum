import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  parseMenu,
  validateItems,
  type MenuPhoto,
} from "../supabase/functions/_shared/menu-domain";
const id = "90000000-0000-4000-8000-000000000001";
function row(texts: string[]): MenuPhoto {
  return {
    id,
    imageRevision: 1,
    width: 1200,
    height: 1600,
    engine: "manual",
    lines: texts.map((text, n) => ({
      id: `${id}:1:${n}`,
      text,
      confidence: null,
      polygon: [
        { x: 0.05 + n * 0.23, y: 0.2 },
        { x: 0.22 + n * 0.23, y: 0.2 },
        { x: 0.22 + n * 0.23, y: 0.24 },
        { x: 0.05 + n * 0.23, y: 0.24 },
      ],
    })),
  };
}
test("damaged standalone amounts retain the label but cannot invent currency or volume", () => {
  for (const amount of [
    "12,000%",
    "25,000l",
    "90,0002",
    "15,000％",
    "₩90,0002",
  ]) {
    const p = row(["처음 보는 술 30ml", amount]);
    const raw = JSON.stringify(p);
    const items = parseMenu([p]);
    validateItems(items, [p]);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "처음 보는 술");
    assert.equal(items[0].price, null);
    assert.equal(items[0].serving, "30ml");
    assert.equal(items[0].confirmed, false);
    assert.equal(items[0].productId, null);
    assert.deepEqual(
      items[0].lineIds,
      p.lines.map((l) => l.id),
    );
    assert.equal(JSON.stringify(p), raw);
  }
});
test("damaged left column cannot steal a valid right column price", () => {
  const p = row([
    "메이커스 마크 30ml",
    "12,000%",
    "Guinness Draught 500ml",
    "9,000",
  ]);
  const items = parseMenu([p]);
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((i) => [i.name, i.price, i.serving]),
    [
      ["메이커스 마크", null, "30ml"],
      ["Guinness Draught", 9000, "500ml"],
    ],
  );
  assert.deepEqual(
    items.map((i) => i.lineIds),
    [p.lines.slice(0, 2).map((l) => l.id), p.lines.slice(2).map((l) => l.id)],
  );
});
test("exact known unpriced names survive while generic headings and bare years stay raw", () => {
  const known = row(["글렌피딕 12년"]);
  assert.equal(parseMenu([known])[0].price, null);
  for (const text of [
    "WHISKY",
    "오늘의 추천",
    "빈티지 2024",
    "30ml",
    "12,000%",
    "알코올 40%",
  ])
    assert.deepEqual(parseMenu([row([text])]), []);
});
test("actual Android OCR recovers missing rows with null prices and preserves both columns", () => {
  const report = JSON.parse(
    readFileSync(
      "docs/verification/ocr-benchmark/android-photo-cache-cleanup.json",
      "utf8",
    ),
  );
  for (const fixture of ["light", "two-columns"]) {
    const raw = report.cases.find(
      (c: { id: string }) => c.id === fixture,
    ).rawNative;
    const p: MenuPhoto = {
      ...raw,
      id,
      imageRevision: 1,
      lines: raw.lines.map((l: object, n: number) => ({
        ...l,
        id: `${id}:1:${n}`,
      })),
    };
    const items = parseMenu([p]);
    validateItems(items, [p]);
    assert.equal(items.length, 6);
    assert.ok(items.filter((i) => i.price === null).length >= 2);
    assert.ok(
      items.some((i) => i.name.includes("메이커스") && i.price === null),
    );
  }
});
