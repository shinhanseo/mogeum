import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeCutoutCache,
  validateCutoutSource,
} from "../src/features/cutout/cache-contract";
import {
  deletedAccountKeys,
  localDataOwner,
} from "../src/features/auth/deletion-local";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  hash = "a".repeat(64);
test("cutout cache is bound to exact owner/source and cannot authorize a different file", () => {
  const source = `${owner}/records/photo.jpg`;
  const raw = JSON.stringify({ [hash]: { source, file: `${hash}.png` } });
  assert.equal(decodeCutoutCache(raw, owner)[hash].source, source);
  assert.throws(() => decodeCutoutCache(raw, other));
  for (const file of [
    "../../photo.png",
    "https://host/image.png",
    `${"b".repeat(64)}.png`,
  ])
    assert.throws(() =>
      decodeCutoutCache(JSON.stringify({ [hash]: { source, file } }), owner),
    );
  for (const source of [
    `${owner}/records/../photo.jpg`,
    `${owner}/records/photo.jpg?token=secret`,
    `${other}/records/photo.jpg`,
  ])
    assert.throws(() => validateCutoutSource(owner, source));
});
test("deletion clears only cutout presentation keys belonging to the deleted account", () => {
  const keys = [
    `mogeum:cutout:v1:${owner}`,
    `mogeum:cutout:v1:${other}`,
    "supabase-auth-token",
  ];
  assert.equal(localDataOwner(keys[0]), owner);
  assert.deepEqual(deletedAccountKeys(owner, keys), [keys[0]]);
});
