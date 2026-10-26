import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelNoteEdit,
  newTastingDraft,
  setAnswer,
} from "../src/features/tasting/draft";
import { createTastingDraftStorage } from "../src/features/tasting/draft-storage";

test("cancelled prose does not reopen as an editor after persisted draft restoration", async () => {
  let raw: string | null = null;
  const storage = createTastingDraftStorage({
    getItem: async () => raw,
    setItem: async (_key, value) => {
      raw = value;
    },
    removeItem: async () => {
      raw = null;
    },
  });
  const base = setAnswer(
    newTastingDraft("qa-owner", "qa-record", "whisky", "light"),
    "nose",
    {
      status: "answered",
      descriptors: ["fruit"],
      freeText: "",
      intensity: null,
    },
  );
  const applied = {
    ...base,
    composition: {
      text: "내가 적용한 문장",
      edited: true,
      sourceRevision: base.revision,
    },
  };
  const editing = {
    ...applied,
    composition: {
      ...applied.composition,
      editBuffer: "아직 적용하지 않은 문장",
    },
  };
  await storage.persist(editing);
  assert.equal(
    (await storage.restore(base.ownerId, base.recordId))?.composition
      ?.editBuffer,
    "아직 적용하지 않은 문장",
  );
  const cancelled = cancelNoteEdit(editing);
  await storage.persist(cancelled);
  const reopened = await storage.restore(base.ownerId, base.recordId);
  assert.equal(reopened?.composition?.editBuffer, undefined);
  assert.deepEqual(reopened, applied);
  assert.equal(editing.composition.editBuffer, "아직 적용하지 않은 문장");
  assert.deepEqual(reopened?.modes, base.modes);
});
test("cancelling an untouched edit does not fabricate a draft or change saved text metadata", () => {
  const base = newTastingDraft("qa-owner", "qa-record", "wine", "deep");
  assert.equal(cancelNoteEdit(base), base);
  const preview = {
    ...base,
    composition: { text: "기존 문장", edited: false, sourceRevision: 1 },
  };
  assert.equal(cancelNoteEdit(preview), preview);
});
