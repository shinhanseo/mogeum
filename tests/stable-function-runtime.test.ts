import { test } from "node:test";
import assert from "node:assert/strict";
import { waitForStableFunction } from "../scripts/stable-function-runtime";
test("deployment readiness resets its stable window across worker restart, stale build and gateway failures", async () => {
  let time = 0,
    calls = 0;
  const values = [
    { status: 401, build: "new" },
    { status: 502, build: null },
    { status: 401, build: "old" },
    { status: 401, build: "new" },
    { status: 401, build: "new" },
    { status: 401, build: "new" },
  ];
  await waitForStableFunction(
    {
      probe: async () => values[calls++],
      now: () => time,
      pause: async () => {
        time += 100;
      },
    },
    "new",
    200,
    10,
  );
  assert.equal(calls, 6);
});
test("a repeated unauthorized response from a wrong build never starts destructive verification", async () => {
  let calls = 0,
    time = 0;
  await assert.rejects(
    waitForStableFunction(
      {
        probe: async () => {
          calls++;
          return { status: 401, build: "old" };
        },
        now: () => time,
        pause: async () => {
          time += 100;
        },
      },
      "new",
      200,
      4,
    ),
    /did not stabilize/,
  );
  assert.equal(calls, 4);
});
