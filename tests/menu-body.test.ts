import assert from "node:assert/strict";
import test from "node:test";
import { readMenuBody } from "../supabase/functions/_shared/menu-body";
const encoder = new TextEncoder();
test("UTF-8 split across chunks preserves Korean and emoji at the character boundary", async () => {
  const expected = "한🍷글";
  const bytes = encoder.encode(expected);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  assert.equal(
    await readMenuBody(new Response(stream), expected.length),
    expected,
  );
});
test("exact character boundary is accepted and the next character cancels further body reading", async () => {
  assert.equal(
    await readMenuBody(new Response("가".repeat(20)), 20),
    "가".repeat(20),
  );
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(encoder.encode("a".repeat(21)));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readMenuBody(new Response(stream), 20), /TOO_LARGE/);
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
});
test("missing or understated content length cannot bypass streamed byte limits", async () => {
  for (const headers of [
    new Headers(),
    new Headers({ "content-length": "1" }),
  ]) {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(64));
      },
    });
    await assert.rejects(
      readMenuBody(new Response(stream, { headers }), 20),
      /TOO_LARGE/,
    );
  }
});
test("declared oversize cancels without pulling an entire request", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readMenuBody(
      new Response(stream, { headers: { "content-length": "64" } }),
      20,
    ),
    /TOO_LARGE/,
  );
  assert.equal(cancelled, true);
});
test("empty bodies and stream failures are not converted into valid JSON", async () => {
  assert.equal(await readMenuBody(new Response(null)), "");
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.error(new Error("synthetic read failure"));
    },
  });
  await assert.rejects(
    readMenuBody(new Response(stream)),
    /synthetic read failure/,
  );
  assert.equal(stream.locked, false);
});

test("a leading UTF-8 BOM does not consume the existing decoded character budget", async () => {
  assert.equal(
    await readMenuBody(
      new Response(
        new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode("가".repeat(20))]),
      ),
      20,
    ),
    "가".repeat(20),
  );
});
