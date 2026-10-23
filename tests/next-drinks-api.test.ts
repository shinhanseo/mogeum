import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { tastingRepository } from "../src/features/tasting/repository";
import { newTastingDraft, setAnswer } from "../src/features/tasting/draft";
import { composeNote } from "../src/features/tasting/answers";
test(
  "next drinks: real Auth, complete older history, sensory evidence, wishlist replay and owner isolation",
  {
    skip:
      process.env.MOGEUM_TEST_SUPABASE_HTTP !== "1"
        ? "Needs isolated local Supabase HTTP"
        : false,
    timeout: 90000,
  },
  async () => {
    const status = JSON.parse(
      execFileSync(
        resolve("node_modules/.bin/supabase"),
        ["status", "-o", "json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
    assert.equal(status.API_URL, "http://127.0.0.1:54321");
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const users: string[] = [];
    const make = () =>
      createClient(status.API_URL, status.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    try {
      const a = make(),
        b = make();
      for (const sdk of [a, b]) {
        const { data, error } = await sdk.auth.signUp({
          email: `next-${randomUUID()}@example.test`,
          password: randomUUID() + "Aa1!",
        });
        if (data.user) users.push(data.user.id);
        assert.ok(!error && data.session && data.user);
      }
      const token = (await a.auth.getSession()).data.session!.access_token;
      const request = (body: unknown, bearer?: string) =>
        fetch(`${status.API_URL}/functions/v1/next-drinks`, {
          method: "POST",
          headers: {
            apikey: status.ANON_KEY,
            "Content-Type": "application/json",
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        });
      assert.equal((await request({})).status, 401);
      assert.equal((await request({ userId: users[1] }, token)).status, 400);
      assert.equal((await request({ category: "made-up" }, token)).status, 400);
      assert.equal(
        (await request({ category: "x".repeat(3000) }, token)).status,
        413,
      );
      const initial = await request({}, token);
      assert.equal(initial.status, 200);
      const empty = await initial.json();
      assert.equal(empty.recommendations.length, 32);
      assert.ok(
        empty.recommendations.every(
          (r: { kind: string; similar: unknown[] }) =>
            r.kind === "explore" && !r.similar.length,
        ),
      );
      const operation = randomUUID();
      const bookmark = () =>
        a.rpc("set_drink_wishlist", {
          p_operation_id: operation,
          p_product_id: "glenlivet-12",
          p_saved: true,
          p_expected_revision: 0,
        });
      const [first, concurrent] = await Promise.all([bookmark(), bookmark()]);
    assert.equal(concurrent.error, null);
    assert.equal(concurrent.data.revision, 1);
    assert.equal(Number(first.data.replayed) + Number(concurrent.data.replayed), 1);
      assert.equal(first.error, null);
      assert.equal(first.data.revision, 1);
      assert.equal((await bookmark()).data.replayed, true);
      assert.equal(
        (await a.rpc("taste_summary_context")).data.snapshot.totalRecords,
        0,
      );
      assert.equal(
        (await b.from("drink_wishlist").select("*").eq("user_id", users[0]))
          .data?.length,
        0,
      );
      let latest: { recordId: string; revision: number } | null = null;
      for (let n = 0; n < 201; n++) {
        const result = await a.rpc("create_tasting_record", {
          p_operation_id: randomUUID(),
          p_record: {
            enteredName: n === 0 ? "Glenfiddich 12" : `합성 기록 ${n}`,
            category: "whisky",
            revisit: "again",
            consumedAt: n === 0 ? "2000-01-01" : "2026-10-23",
          },
        });
        assert.equal(result.error, null);
        latest = result.data;
      }
      let draft = newTastingDraft(
        users[0],
        latest!.recordId,
        "whisky",
        "light",
      );
      draft = setAnswer(draft, "nose", {
        status: "answered",
        descriptors: ["fruit"],
        intensity: null,
        freeText: "",
      });
      await tastingRepository(a).save(
        draft,
        randomUUID(),
        latest!.revision,
        composeNote(draft),
        false,
      );
      const response = await request({}, token);
      assert.equal(response.status, 200);
      const value = await response.json();
      assert.equal(value.recordCount, 201);
      assert.equal(value.omittedSensoryRecords, 1);
      assert.equal(value.modelUsed, false);
      assert.equal(
        value.recommendations.some(
          (r: { product: { id: string } }) => r.product.id === "glenfiddich-12",
        ),
        false,
      );
      const glenlivet = value.recommendations.find(
        (r: { product: { id: string } }) => r.product.id === "glenlivet-12",
      );
      assert.ok(
        glenlivet.similar.some((f: { recordIds: string[] }) =>
          f.recordIds.includes(latest!.recordId),
        ),
      );
      assert.equal(value.wishlist[0].product_id, "glenlivet-12");
      const foreign = await b.functions.invoke("next-drinks", { body: {} });
      assert.equal(foreign.error, null);
      assert.equal(foreign.data.evidenceRecords.length, 0);
      assert.equal(foreign.data.wishlist.length, 0);
    } finally {
      for (const id of users) {
        const result = await admin.auth.admin.deleteUser(id);
        if (result.error)
          throw new Error("Synthetic next-drinks cleanup failed");
      }
    }
  },
);
