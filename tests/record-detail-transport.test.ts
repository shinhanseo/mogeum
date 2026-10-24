import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadRecordDetail } from "../src/features/records/detail";
const owner = "90000000-0000-4000-8000-000000000001";
const path = `${owner}/records/synthetic/photo.jpg`;
const record = {
  id: "synthetic-record",
  revision: 1,
  cellar_entry_id: "synthetic-entry",
  record_notes: [],
  record_photos: [
    { storage_path: path, sort_order: 0, upload_status: "ready" },
  ],
};
function client(fetcher: typeof fetch) {
  return createClient(
    "https://synthetic.example.test",
    "synthetic-public-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetcher },
    },
  );
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { resolve, promise };
}
for (const phase of ["record", "history"] as const)
  test(`a blocked ${phase} HTTP request receives cancellation and never returns partial detail`, async () => {
    const gate = deferred();
    const controller = new AbortController();
    let calls = 0;
    const sdk = client(async (input, options) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
      calls++;
      if (phase === "history" && calls === 1) return Response.json(record);
      assert.equal(options?.signal, controller.signal);
      gate.resolve();
      return new Promise<Response>((_resolve, reject) => {
        const abort = () =>
          reject(new DOMException("Synthetic request aborted", "AbortError"));
        if (options?.signal?.aborted) abort();
        else options?.signal?.addEventListener("abort", abort, { once: true });
      });
    });
    const pending = loadRecordDetail(
      sdk,
      owner,
      { recordId: record.id },
      controller.signal,
    );
    await gate.promise;
    controller.abort();
    await assert.rejects(
      pending,
      (e: unknown) =>
        typeof (e as { message?: unknown }).message === "string" &&
        String((e as { message: string }).message).includes("aborted"),
    );
    assert.equal(calls, phase === "record" ? 1 : 2);
  });
test("private photo signing uses the bounded batch endpoint; signing failure preserves verified record and history", async () => {
  let signs = 0;
  let reads = 0;
  const sdk = client(async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/v1/tasting_records") {
      assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
      assert.ok(options?.signal);
      return Response.json(
        ++reads === 1
          ? record
          : [{ id: record.id, consumed_at: "2026-10-19T12:00:00Z" }],
      );
    }
    assert.equal(url.pathname, "/storage/v1/object/sign/record-photos");
    assert.deepEqual(JSON.parse(String(options?.body)), {
      expiresIn: 300,
      paths: [path],
    });
    signs++;
    return Response.json(
      { message: "Synthetic signing unavailable" },
      { status: 503 },
    );
  });
  const result = await loadRecordDetail(sdk, owner, { recordId: record.id });
  assert.equal(signs, 1);
  assert.equal(result.photoUri, null);
  assert.equal(result.record.id, record.id);
  assert.equal(result.history.length, 1);
});
test("an unexpected foreign photo path is never sent for signing", async () => {
  let reads = 0;
  const sdk = client(async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/rest/v1/tasting_records");
    return Response.json(
      ++reads === 1
        ? {
            ...record,
            record_photos: [
              {
                ...record.record_photos[0],
                storage_path: "foreign/records/photo.jpg",
              },
            ],
          }
        : [],
    );
  });
  assert.equal(
    (await loadRecordDetail(sdk, owner, { recordId: record.id })).photoUri,
    null,
  );
  assert.equal(reads, 2);
});
