import { products } from "../supabase/functions/_shared/product-catalog";
import { SHARED_CATALOG_VERSION } from "../supabase/functions/_shared/catalog-contract";
import { loadDiscoveryPrefill } from "../src/features/discovery/repository";
import { createWishlistQueue } from "../src/features/discovery/wishlist";
import { parseDiscoveryResult } from "../src/features/discovery/contract";
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
    skip: process.env.MOGEUM_TEST_SUPABASE_HTTP !== "1"
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
    const fixtureId = `synthetic-dynamic-${randomUUID()}`;
    const originalEnv = [
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ];
    process.env.EXPO_PUBLIC_SUPABASE_URL = status.API_URL;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
    const make = (key = status.ANON_KEY) =>
      createClient(status.API_URL, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    try {
      assert.match(status.PUBLISHABLE_KEY, /^sb_publishable_/);
      const a = make(status.PUBLISHABLE_KEY),
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
          body: JSON.stringify(
            typeof body === "object" && body !== null
              ? { catalogVersion: SHARED_CATALOG_VERSION, ...body }
              : body,
          ),
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
      parseDiscoveryResult(empty);
      assert.deepEqual(empty.recommendations, []);
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
      assert.equal(
        Number(first.data.replayed) + Number(concurrent.data.replayed),
        1,
      );
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
      let pendingWishlist: string | null = null,
        loseResponse = true;
      const queue = createWishlistQueue({
        active: (id) => id === users[0],
        read: async () => pendingWishlist,
        write: async (_owner, raw) => {
          pendingWishlist = raw;
        },
        remove: async () => {
          pendingWishlist = null;
        },
        apply: async (op) => {
          const response = await a.rpc("set_drink_wishlist", {
            p_operation_id: op.operationId,
            p_product_id: op.productId,
            p_saved: op.saved,
            p_expected_revision: op.expectedRevision,
          });
          assert.equal(response.error, null);
          if (loseResponse) {
            loseResponse = false;
            throw new Error("synthetic response loss after commit");
          }
          return response.data;
        },
        refresh: async () => {
          const rows = await a
            .from("drink_wishlist")
            .select("product_id,saved,revision");
          assert.equal(rows.error, null);
          return rows.data!.map((r) => ({
            productId: r.product_id,
            saved: r.saved,
            revision: r.revision,
          }));
        },
      });
      await assert.rejects(
        queue.submit({
          version: 1,
          owner: users[0],
          operationId: randomUUID(),
          productId: "makers-mark",
          saved: true,
          expectedRevision: 0,
        }),
        /synthetic response loss/,
      );
      assert.ok(pendingWishlist);
      const recovered = await queue.resume(users[0]);
      assert.equal(
        recovered!.state.find((r) => r.productId === "makers-mark")!.revision,
        1,
      );
      assert.equal(pendingWishlist, null);
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
      parseDiscoveryResult(value);
      assert.equal(value.recordCount, 201);
      assert.equal(value.omittedSensoryRecords, 1);
      assert.equal(value.modelUsed, false);
      assert.equal(
        value.recommendations.some(
          (r: { product: { id: string } }) => r.product.id === "glenfiddich-12",
        ),
        false,
      );
      assert.equal(value.wishlist[0].product_id, "glenlivet-12");
      assert.ok(
        !value.recommendations.some((r: { product: { id: string } }) =>
          ["glenlivet-12", "makers-mark"].includes(r.product.id)
        ),
      );
      const unsave = await a.rpc("set_drink_wishlist", {
        p_operation_id: randomUUID(),
        p_product_id: "glenlivet-12",
        p_saved: false,
        p_expected_revision: 1,
      });
      assert.equal(unsave.error, null);
      const refreshedResponse = await request({}, token);
      assert.equal(refreshedResponse.status, 200);
      const refreshed = await refreshedResponse.json();
      parseDiscoveryResult(refreshed);
      assert.equal(
        refreshed.wishlist.find((r: { product_id: string }) =>
          r.product_id === "glenlivet-12"
        ).saved,
        false,
      );
      assert.ok(
        !refreshed.recommendations.some((r: { product: { id: string } }) =>
          ["glenfiddich-12", "makers-mark"].includes(r.product.id)
        ),
      );
      const glenlivet = refreshed.recommendations.find(
        (r: { product: { id: string } }) => r.product.id === "glenlivet-12",
      );
      assert.ok(
        glenlivet.similar.some((f: { recordIds: string[] }) =>
          f.recordIds.includes(latest!.recordId)
        ),
      );
      assert.equal(value.wishlist[0].product_id, "glenlivet-12");
      // Only an isolated local service-role fixture can add/promote these synthetic facts.
      const synthetic = {
        ...products.find((p) => p.id === "glenlivet-12")!,
        id: fixtureId,
        familyId: fixtureId,
        name: "합성 동적 제품",
        aliases: ["Synthetic Dynamic"],
        baseAliases: ["Synthetic Dynamic"],
      };
      assert.equal(
        (await admin.from("product_catalog").insert({
          id: fixtureId,
          family_id: fixtureId,
          category: "whisky",
          normalized_name: "synthetic dynamic",
          document: synthetic,
          status: "candidate",
        })).error,
        null,
      );
      const candidate = await (await request({}, token)).json();
      assert.ok(
        !candidate.catalog.some((p: { id: string }) => p.id === fixtureId),
      );
      await assert.rejects(
        loadDiscoveryPrefill(a, users[0], fixtureId),
        /CATALOG_PRODUCT_UNAVAILABLE/,
      );
      assert.equal(
        (await a.rpc("set_drink_wishlist", {
          p_operation_id: randomUUID(),
          p_product_id: fixtureId,
          p_saved: true,
          p_expected_revision: 0,
        })).error?.message,
        "PRODUCT_NOT_VERIFIED",
      );
      assert.equal(
        (await admin.from("product_catalog").update({
          status: "verified",
          verified_at: new Date().toISOString(),
        }).eq("id", fixtureId)).error,
        null,
      );
      const dynamicResponse = await request({}, token);
      assert.equal(dynamicResponse.status, 200);
      const dynamic = parseDiscoveryResult(await dynamicResponse.json());
      assert.ok(
        dynamic.recommendations.some((r) => r.product.id === fixtureId),
      );
      assert.equal(
        (await loadDiscoveryPrefill(a, users[0], fixtureId))?.name,
        synthetic.name,
      );
      assert.equal(
        (await a.rpc("set_drink_wishlist", {
          p_operation_id: randomUUID(),
          p_product_id: fixtureId,
          p_saved: true,
          p_expected_revision: 0,
        })).error,
        null,
      );
      const savedDynamic = parseDiscoveryResult(
        await (await request({}, token)).json(),
      );
      assert.ok(
        savedDynamic.wishlist.some((r) =>
          r.product_id === fixtureId && r.saved
        ),
      );
      assert.ok(
        !savedDynamic.recommendations.some((r) => r.product.id === fixtureId),
      );
      assert.equal(
        (await admin.from("product_catalog").update({ status: "held" }).eq(
          "id",
          fixtureId,
        )).error,
        null,
      );
      const held = parseDiscoveryResult(
        await (await request({}, token)).json(),
      );
      assert.ok(!held.catalog.some((p) => p.id === fixtureId));
      assert.ok(
        held.wishlist.some((r) => r.product_id === fixtureId && r.saved),
      );
      await assert.rejects(
        loadDiscoveryPrefill(a, users[0], fixtureId),
        /CATALOG_PRODUCT_UNAVAILABLE/,
      );
      assert.equal(
        (await a.rpc("set_drink_wishlist", {
          p_operation_id: randomUUID(),
          p_product_id: fixtureId,
          p_saved: false,
          p_expected_revision: 1,
        })).error,
        null,
      );
      // Existing installed binaries still receive their pinned contract during rollout.
      const legacy = await a.functions.invoke("next-drinks", { body: {} });
      assert.equal(legacy.error, null);
      parseDiscoveryResult(legacy.data);
      assert.equal(legacy.data.catalog, undefined);
      const foreign = await b.functions.invoke("next-drinks", { body: {} });
      assert.equal(foreign.error, null);
      assert.deepEqual(foreign.data.recommendations, []);
      assert.equal(foreign.data.evidenceRecords.length, 0);
      assert.equal(foreign.data.wishlist.length, 0);
    } finally {
      for (
        const [index, key] of [
          "EXPO_PUBLIC_SUPABASE_URL",
          "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        ].entries()
      ) {
        const previous = originalEnv[index];
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
      }
      for (const id of users) {
        const result = await admin.auth.admin.deleteUser(id);
        if (result.error) {
          throw new Error("Synthetic next-drinks cleanup failed");
        }
      }
      assert.equal(
        (await admin.from("product_catalog").delete().eq("id", fixtureId))
          .error,
        null,
      );
    }
  },
);
