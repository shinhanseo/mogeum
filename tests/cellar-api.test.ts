import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createCellarRepository } from "../src/features/cellar/repository";
test(
  "real cellar cursor pages cover tied dates, unloaded search, literal wildcards and owner isolation",
  {
    skip:
      process.env.MOGEUM_TEST_SUPABASE_HTTP !== "1"
        ? "Needs isolated local Supabase HTTP"
        : false,
    timeout: 60000,
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
    const client = () =>
      createClient(status.API_URL, status.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const users: string[] = [];
    try {
      const a = client(),
        b = client();
      for (const sdk of [a, b]) {
        const { data, error } = await sdk.auth.signUp({
          email: `cellar-${randomUUID()}@example.test`,
          password: randomUUID() + "Aa1!",
        });
        assert.ok(!error && data.user && data.session);
        users.push(data.user!.id);
      }
      const ids: string[] = [];
      const recordIds: string[] = [];
      for (let n = 0; n < 35; n++) {
        const r = await a.rpc("create_tasting_record", {
          p_operation_id: randomUUID(),
          p_record: {
            enteredName: n === 34 ? "찾기 100%_한잔" : "합성 술 " + n,
            category: n === 34 ? "wine" : "whisky",
            consumedAt: "2026-10-23T00:00:00Z",
          },
        });
        assert.equal(r.error, null);
        ids.push(r.data.cellarEntryId);
        recordIds.push(r.data.recordId);
      }
      const precision = await admin
        .from("tasting_records")
        .update({ consumed_at: "2026-10-23T00:00:00.123456+00:00" })
        .in("id", recordIds);
      assert.equal(precision.error, null);
      const repo = createCellarRepository(a, users[0]),
        filter = { query: "", category: "전체" as const };
      const first = await repo.page(filter, null, () => true);
      assert.equal(first.items.length, 30);
      assert.equal(first.total, 35);
      assert.ok(first.next);
      assert.match(first.next.date!, /\.123456/);
      const second = await repo.page(filter, first.next, () => true);
      assert.equal(second.items.length, 5);
      assert.equal(second.next, null);
      assert.deepEqual(
        [...new Set([...first.items, ...second.items].map((i) => i.id))].sort(),
        ids.sort(),
      );
      const wine = await repo.page(
        { query: "", category: "와인" },
        null,
        () => true,
      );
      assert.equal(wine.items.length, 1);
      assert.equal(wine.total, 35);
      const literal = await repo.page(
        { query: "100%_", category: "전체" },
        null,
        () => true,
      );
      assert.equal(literal.items.length, 1);
      assert.equal(literal.items[0].name, "찾기 100%_한잔");
      const foreign = await createCellarRepository(b, users[0]).page(
        filter,
        null,
        () => true,
      );
      assert.equal(foreign.items.length, 0);
      assert.equal(foreign.total, 0);
      await assert.rejects(
        repo.page(
          filter,
          { date: "2026-10-23),id.gt.secret", id: ids[0] },
          () => true,
        ),
        /INVALID_CURSOR/,
      );
    } finally {
      for (const id of users) {
        const result = await admin.auth.admin.deleteUser(id);
        if (result.error)
          throw new Error("Synthetic cellar user cleanup failed");
      }
    }
  },
);
