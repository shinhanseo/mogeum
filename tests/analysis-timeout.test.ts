import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setImmediate } from "node:timers/promises";
import { generateTasteSummary } from "../src/features/taste/repository";

test("unresponsive summary transport aborts and returns safe failure with the pinned owner JWT", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = false;
  let sent = false;
  const transport = createClient(
    "https://synthetic.example.test",
    "synthetic-public-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (_url, options) => {
          sent = true;
          assert.equal(
            new Headers(options?.headers).get("Authorization"),
            "Bearer synthetic-owner-token",
          );
          return new Promise<Response>((_resolve, reject) => {
            const signal = options?.signal;
            assert.ok(signal);
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          });
        },
      },
    },
  );
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: { id: "owner" },
            access_token: "synthetic-owner-token",
          },
        },
      }),
    },
    functions: transport.functions,
  } as unknown as SupabaseClient;
  const result = generateTasteSummary(client, "owner");
  const rejected = assert.rejects(
    result,
    (e: Error & { code?: string }) =>
      e.code === "ANALYSIS_FAILED" &&
      !e.message.includes("synthetic-owner-token"),
  );
  await setImmediate();
  assert.equal(sent, true);
  t.mock.timers.tick(35000);
  await rejected;
  assert.equal(aborted, true);
});
