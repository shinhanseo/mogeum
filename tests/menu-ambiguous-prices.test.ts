import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  parseMenu,
  type MenuPhoto,
} from "../supabase/functions/_shared/menu-domain";
const id = "90000000-0000-4000-8000-000000000001";
test("Galaxy native OCR with damaged dual prices never silently selects the surviving amount", () => {
  const report = JSON.parse(
    readFileSync(
      "docs/verification/ocr-benchmark/android-galaxy-20261026.json",
      "utf8",
    ),
  );
  const native = report.cases.find(
    (c: { id: string }) => c.id === "ambiguous-price",
  ).rawNative;
  const photo: MenuPhoto = {
    id,
    imageRevision: 1,
    width: native.width,
    height: native.height,
    engine: native.engine,
    lines: native.lines.map(
      (line: MenuPhoto["lines"][number], index: number) => ({
        ...line,
        id: `${id}:1:${index}`,
      }),
    ),
  };
  const items = parseMenu([photo]);
  assert.ok(
    items.length > 0,
    "uncertain candidates remain available for manual review",
  );
  assert.ok(items.every((item) => item.price === null));
  assert.ok(items.every((item) => !item.confirmed && item.productId === null));
});
test("damaged secondary amounts do not turn a dual-price row into a single-price row", () => {
  const row = (text: string): MenuPhoto => ({
    id,
    imageRevision: 1,
    width: 100,
    height: 100,
    engine: "manual",
    lines: [
      {
        id: `${id}:1:0`,
        text,
        confidence: null,
        polygon: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.9, y: 0.2 },
          { x: 0.1, y: 0.2 },
        ],
      },
    ],
  });
  for (const text of [
    "메이커스 마크 30ml 12,000% / 150,000",
    "메이커스 마크 9,000 | 150,0002",
    "메이커스 마크 15,000 / 150,000원",
  ])
    assert.equal(parseMenu([row(text)])[0]?.price, null, text);
  for (const [text, expected] of [
    ["메이커스 마크 30ml 12,000원", 12000],
    ["메이커스 마크 ₩12000", 12000],
  ] as const)
    assert.equal(parseMenu([row(text)])[0]?.price, expected);
});
