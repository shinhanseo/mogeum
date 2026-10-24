import assert from "node:assert/strict";
import test from "node:test";
import { refreshMenuEvidence } from "../src/features/menu/evidence";
import { menuFailureMessage } from "../src/features/menu/result-contract";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
test("same record hash refreshes expiring links rather than reusing the prior signed URL", async () => {
  let calls = 0;
  const ports = {
    active: () => true,
    hash: async () => "current",
    photos: async () => ({ record: `signed-link-${++calls}` }),
  };
  assert.deepEqual(await refreshMenuEvidence("current", ports), {
    status: "fresh",
    photos: { record: "signed-link-1" },
  });
  assert.deepEqual(await refreshMenuEvidence("current", ports), {
    status: "fresh",
    photos: { record: "signed-link-2" },
  });
});
test("changed records invalidate recommendations before signing or exposing evidence photos", async () => {
  let calls = 0;
  const result = await refreshMenuEvidence("old", {
    active: () => true,
    hash: async () => "new",
    photos: async () => {
      calls++;
      return {};
    },
  });
  assert.deepEqual(result, { status: "stale" });
  assert.equal(calls, 0);
  assert.match(
    menuFailureMessage(new Error("MENU_EVIDENCE_STALE"), "recommend"),
    /기록.*바뀌/,
  );
});
test("closed or superseded operations do not start a context request", async () => {
  let calls = 0;
  assert.deepEqual(
    await refreshMenuEvidence("current", {
      active: () => false,
      hash: async () => {
        calls++;
        return "current";
      },
      photos: async () => ({}),
    }),
    { status: "cancelled" },
  );
  assert.equal(calls, 0);
});
test("account change or a newer recommendation during context lookup cannot publish old evidence", async () => {
  let active = true,
    calls = 0;
  const hash = deferred<string>();
  const pending = refreshMenuEvidence("current", {
    active: () => active,
    hash: () => hash.promise,
    photos: async () => {
      calls++;
      return { record: "old" };
    },
  });
  active = false;
  hash.resolve("current");
  assert.deepEqual(await pending, { status: "cancelled" });
  assert.equal(calls, 0);
});
test("late photo signing from an older refresh is ignored", async () => {
  let active = true;
  const images = deferred<Record<string, string>>(),
    started = deferred<void>();
  const pending = refreshMenuEvidence("current", {
    active: () => active,
    hash: async () => "current",
    photos: () => {
      started.resolve();
      return images.promise;
    },
  });
  await started.promise;
  active = false;
  images.resolve({ record: "expired-operation" });
  assert.deepEqual(await pending, { status: "cancelled" });
});
test("network or malformed context cannot silently keep a supposedly verified recommendation", async () => {
  await assert.rejects(
    refreshMenuEvidence("current", {
      active: () => true,
      hash: async () => {
        throw new Error("network unavailable");
      },
      photos: async () => ({}),
    }),
    /unavailable/,
  );
  await assert.rejects(
    refreshMenuEvidence("current", {
      active: () => true,
      hash: async () => "",
      photos: async () => ({}),
    }),
    /INVALID_TASTE_CONTEXT/,
  );
});
test("photo signing failure preserves valid text evidence with explicit absence of photo URLs", async () => {
  assert.deepEqual(
    await refreshMenuEvidence("current", {
      active: () => true,
      hash: async () => "current",
      photos: async () => {
        throw new Error("private image unavailable");
      },
    }),
    { status: "fresh", photos: {} },
  );
});
