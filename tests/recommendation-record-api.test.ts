import { loadRecordDetail } from "../src/features/records/detail";
import { tastingRepository } from "../src/features/tasting/repository";
import { newTastingDraft, setAnswer } from "../src/features/tasting/draft";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadDiscoveryPrefill } from "../src/features/discovery/repository";
import {
  createRecordRepository,
  type RecordInput,
} from "../src/features/records/repository";

test(
  "verified recommendation identity can become a photo-free record in every category; retry creates no duplicate",
  {
    skip:
      process.env.MOGEUM_TEST_SUPABASE_HTTP !== "1"
        ? "Needs isolated local Supabase HTTP"
        : false,
    timeout: 45000,
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
    const originalEnv = [
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ];
    process.env.EXPO_PUBLIC_SUPABASE_URL = status.API_URL;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    const admin = createClient(
      status.API_URL,
      status.SERVICE_ROLE_KEY,
      options,
    );
    const client = createClient(
      status.API_URL,
      status.PUBLISHABLE_KEY,
      options,
    );
    const created = await admin.auth.admin.createUser({
      email: `record-link-${randomUUID()}@example.test`,
      password: "Test-" + randomUUID(),
      email_confirm: true,
    });
    assert.ifError(created.error);
    const user = created.data.user!;
    try {
      const session = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: user.email!,
      });
      assert.ifError(session.error);
      const signed = await client.auth.verifyOtp({
        type: "magiclink",
        token_hash: session.data.properties!.hashed_token,
      });
      assert.ifError(signed.error);
      for (const id of [
        "glenlivet-12",
        "cloudy-bay-sb-2024",
        "guinness-draught",
        "boksoondoga-son",
      ]) {
        const initial = await loadDiscoveryPrefill(client, user.id, id);
        assert.ok(initial);
        const category = (
          {
            위스키: "whisky",
            와인: "wine",
            맥주: "beer",
            전통주: "traditional",
          } as const
        )[initial.category];
        const input: RecordInput = {
          enteredName: initial.name,
          category,
          revisit: "again",
          consumedAt: new Date().toISOString(),
        };
        if (category === "wine") {
          input.vintageStatus =
            initial.vintageMode === "year"
              ? "year"
              : initial.vintageMode === "NV"
                ? "nv"
                : "unknown";
          if (initial.vintageYear)
            input.vintageYear = Number(initial.vintageYear);
        }
        const operation = randomUUID(),
          repository = createRecordRepository(client);
        const saved = await repository.save(operation, input),
          replayed = await repository.save(operation, input);
        assert.equal(replayed.recordId, saved.recordId);
        assert.equal(replayed.replayed, true);
        const row = await client
          .from("tasting_records")
          .select("*")
          .eq("id", saved.recordId)
          .single();
        assert.ifError(row.error);
        assert.equal(row.data.entered_name, initial.name);
        assert.equal(row.data.category, category);
        assert.equal(row.data.revisit, "again");
      }
      const records = await client
        .from("tasting_records")
        .select("id", { count: "exact" });
      assert.ifError(records.error);
      assert.equal(records.count, 4);
      // Two actual experiences in one cellar entry, saved through the same RPCs as the app.
      const old = await client
        .from("tasting_records")
        .select("id,cellar_entry_id")
        .eq("category", "whisky")
        .single();
      assert.ifError(old.error);
      const again = await createRecordRepository(client).save(
        randomUUID(),
        {
          enteredName: "글렌리벳 12년",
          category: "whisky",
          revisit: "again",
          consumedAt: "2026-12-01T12:00:00Z",
        },
        old.data!.cellar_entry_id,
      );
      for (const [id, code] of [
        [old.data!.id, "fruit"],
        [again.recordId, "honey_vanilla"],
      ]) {
        const draft = setAnswer(
          newTastingDraft(user.id, id, "whisky", "light"),
          "nose",
          {
            status: "answered",
            descriptors: [code],
            intensity: null,
            freeText: "",
          },
        );
        await tastingRepository(client).save(
          draft,
          randomUUID(),
          1,
          "선택한 향을 확인했어요.",
          false,
        );
      }
      const detail = await loadRecordDetail(client, user.id, {
        recordId: again.recordId,
      });
      assert.equal(detail.history.length, 2);
      assert.equal(detail.comparison?.previousId, old.data!.id);
      assert.deepEqual(detail.comparison?.changes, [
        { label: "향", before: "과일", after: "꿀·바닐라" },
      ]);
    } finally {
      for (const [index, key] of [
        "EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ].entries()) {
        if (originalEnv[index] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[index];
      }
      const removed = await admin.auth.admin.deleteUser(user.id);
      assert.ifError(removed.error);
    }
  },
);
