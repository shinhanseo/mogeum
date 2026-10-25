import assert from "node:assert/strict";
import test from "node:test";
import { deletionOwnerAfterEvent } from "../src/features/auth/deletion-events";
test("late work from the prior account cannot replace or dismiss the current deletion gate", () => {
  assert.equal(
    deletionOwnerAfterEvent("B", "B", { owner: "A", active: true }),
    "B",
  );
  assert.equal(
    deletionOwnerAfterEvent("B", "B", { owner: "A", active: false }),
    "B",
  );
  assert.equal(
    deletionOwnerAfterEvent("B", "B", { owner: "B", active: false }),
    null,
  );
  assert.equal(
    deletionOwnerAfterEvent(null, null, { owner: "A", active: true }),
    "A",
  );
});
