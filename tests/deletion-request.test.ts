import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeletionRequest } from "../src/features/auth/deletion-request";
const reply = (status: number, state?: string) =>
  Response.json({ state }, { status });
test("a refreshed session never replaces the original bearer needed to acknowledge a lost completion response", async () => {
  const sent: string[] = [];
  const result = await resolveDeletionRequest(["initial"], "refreshed", {
    send: async (token) => {
      sent.push(token);
      return reply(200, "complete");
    },
    persist: async () => {
      assert.fail("must keep original");
    },
  });
  assert.deepEqual(result, { state: "complete" });
  assert.deepEqual(sent, ["initial"]);
});
test("expired bearer can retry with a new session only after retaining both credentials before the request", async () => {
  let stored = ["initial"];
  const sent: string[] = [];
  await assert.rejects(
    resolveDeletionRequest(stored, "refreshed", {
      send: async (token) => {
        sent.push(token);
        if (token === "initial") return reply(401);
        assert.deepEqual(stored, ["initial", "refreshed"]);
        throw Error("response lost");
      },
      persist: async (tokens) => {
        stored = tokens;
      },
    }),
    /response lost/,
  );
  assert.deepEqual(sent, ["initial", "refreshed"]);
  // The earlier worker may have completed with the initial token while the new attempt was in flight.
  sent.length = 0;
  assert.deepEqual(
    await resolveDeletionRequest(stored, "third", {
      send: async (token) => {
        sent.push(token);
        return token === "initial" ? reply(200, "complete") : reply(401);
      },
      persist: async () => {
        assert.fail("do not evict the surviving receipt");
      },
    }),
    { state: "complete" },
  );
  assert.deepEqual(sent, ["refreshed", "initial"]);
});
test("unavailable server does not replace credentials or treat a retry as complete", async () => {
  await assert.rejects(
    resolveDeletionRequest(["initial"], "new", {
      send: async () => reply(503),
      persist: async () => assert.fail("must not overwrite"),
    }),
    /DELETION_RETRY_REQUIRED/,
  );
  await assert.rejects(
    resolveDeletionRequest(["initial"], undefined, {
      send: async () => reply(401),
      persist: async () => {},
    }),
    /LOGIN_REQUIRED/,
  );
});
