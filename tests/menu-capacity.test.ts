import assert from "node:assert/strict";
import test from "node:test";
import { parseMenu } from "../supabase/functions/_shared/menu-domain";
import { menuFailureMessage } from "../src/features/menu/result-contract";
import { menuWithRows } from "./fixtures/menu-capacity";

test("100 menu entries are retained; the 101st cannot be silently omitted", () => {
  const p = menuWithRows(100);
  const items = parseMenu([p]);
  assert.equal(items.length, 100);
  assert.equal(items[99].name, "합성 메뉴 100");
  const overflow = menuWithRows(101),
    raw = JSON.stringify(overflow);
  assert.throws(() => parseMenu([overflow]), /MENU_ITEM_LIMIT/);
  assert.equal(JSON.stringify(overflow), raw);
});
test("capacity is enforced across pages rather than independently on each photo", () => {
  const a = menuWithRows(50),
    b = menuWithRows(50, "90000000-0000-4000-8000-000000000002");
  assert.equal(parseMenu([a, b]).length, 100);
  const c = menuWithRows(51, b.id);
  assert.throws(() => parseMenu([a, c]), /MENU_ITEM_LIMIT/);
});
test("capacity messages distinguish a real limit from a network retry and preserve input", () => {
  const message = menuFailureMessage(new Error("MENU_ITEM_LIMIT"), "parse");
  assert.match(message, /100개/);
  assert.match(message, /사진을 나눠/);
  assert.match(message, /보관/);
});
