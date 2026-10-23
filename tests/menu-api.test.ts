import { refreshMenuEvidence } from "../src/features/menu/evidence";
import { tastePhotoUrls } from "../src/features/taste/repository";
import { validateMenuResult } from "../src/features/menu/result-contract";
import { createClient } from "@supabase/supabase-js";
import { tastingRepository } from "../src/features/tasting/repository";
import { newTastingDraft, setAnswer } from "../src/features/tasting/draft";
import { composeNote } from "../src/features/tasting/answers";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test } from "node:test";
test(
  "menu HTTP: verified Auth → parse → correction → owner draft → grounded recommendation",
  {
    skip:
      process.env.MOGEUM_TEST_SUPABASE_HTTP !== "1"
        ? "Needs isolated Supabase HTTP services (CI)"
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
    const request = (path: string, token?: string, body?: unknown) =>
      fetch(status.API_URL + path, {
        method: body === undefined ? "GET" : "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          apikey: status.ANON_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const signup = async () => {
      const r = await request("/auth/v1/signup", undefined, {
        email: `menu-${randomUUID()}@example.test`,
        password: randomUUID() + "Aa1!",
      });
      assert.ok(r.ok);
      return r.json();
    };
    const a = await signup(),
      b = await signup();
    const endpoint = "/functions/v1/menu-recommend";
    assert.equal((await request(endpoint, undefined, {})).status, 401);
    assert.equal((await request(endpoint, "invalid", {})).status, 401);
    const id = randomUUID();
    const photos = [
      {
        id,
        imageRevision: 1,
        width: 1200,
        height: 1600,
        engine: "apple-vision-v1",
        lines: [
          {
            id: `${id}:1:0`,
            text: "글렌리벳 12년 30ml 15,000원",
            confidence: 0.95,
            polygon: [
              { x: 0.1, y: 0.1 },
              { x: 0.8, y: 0.1 },
              { x: 0.8, y: 0.2 },
              { x: 0.1, y: 0.2 },
            ],
          },
        ],
      },
    ];
    const parsed = await request(endpoint, a.access_token, {
      action: "parse",
      photos,
    });
    assert.equal(parsed.status, 200);
    const { items } = await parsed.json();
    assert.equal(items[0].price, 15000);
    assert.equal(items[0].productId, null);
    assert.equal(
      (
        await request(endpoint, a.access_token, {
          action: "parse",
          photos: Array.from({ length: 6 }, () => photos[0]),
        })
      ).status,
      400,
    );
    const item = { ...items[0], confirmed: true, productId: "glenlivet-12" };
    const sessionId = randomUUID();
    const payload = {
      p_id: sessionId,
      p_revision: 0,
      p_photos: photos,
      p_items: [item],
    };
    const saved = await request(
      "/rest/v1/rpc/save_menu_session",
      a.access_token,
      payload,
    );
    assert.equal(saved.status, 200);
    assert.equal(await saved.json(), 1);
    const replay = await request(
      "/rest/v1/rpc/save_menu_session",
      a.access_token,
      payload,
    );
    assert.equal(await replay.json(), 1);
    const foreign = await request(
      `/rest/v1/menu_sessions?id=eq.${sessionId}`,
      b.access_token,
    );
    assert.deepEqual(await foreign.json(), []);
    assert.ok(
      !(
        await request("/rest/v1/rpc/save_menu_session", b.access_token, payload)
      ).ok,
    );
    assert.equal(
      (
        await request(endpoint, a.access_token, {
          action: "recommend",
          photos,
          items: [items[0]],
        })
      ).status,
      400,
    );
    const sdk = createClient(status.API_URL, status.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${a.access_token}` } },
    });
    const created = await sdk.rpc("create_tasting_record", {
      p_operation_id: randomUUID(),
      p_record: {
        enteredName: "합성 위스키",
        category: "whisky",
        revisit: "again",
      },
    });
    assert.equal(created.error, null);
    const recordId = created.data.recordId;
    let draft = newTastingDraft(a.user.id, recordId, "whisky", "light");
    draft = setAnswer(draft, "nose", {
      status: "answered",
      descriptors: ["fruit"],
      intensity: null,
      freeText: "",
    });
    await tastingRepository(sdk).save(
      draft,
      randomUUID(),
      created.data.revision,
      composeNote(draft),
      false,
    );
    const response = await request(endpoint, a.access_token, {
      action: "recommend",
      photos,
      items: [item],
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    validateMenuResult(result, [item]);
    assert.equal(result.method, "evidence-rules-v1");
    assert.equal(result.recommendations[0].itemId, item.id);
    assert.equal(result.recommendations[0].status, "similar");
    assert.deepEqual(result.recommendations[0].similar[0].recordIds, [
      recordId,
    ]);
    const refreshed = await refreshMenuEvidence(result.tasteHash, {
      active: () => true,
      async hash() {
        const context = await sdk.rpc("taste_summary_context");
        assert.equal(context.error, null);
        return context.data.snapshot.hash;
      },
      photos: () =>
        tastePhotoUrls(
          sdk,
          a.user.id,
          result.evidenceRecords.map((r: { id: string }) => r.id),
        ),
    });
    assert.equal(refreshed.status, "fresh");
    assert.equal(result.evidenceRecords[0].id, recordId);
    assert.equal(result.evidenceRecords[0].category, "whisky");
    assert.equal(result.evidenceRecords[0].revisit, "again");
    assert.equal(typeof result.evidenceRecords[0].noteText, "string");
    assert.equal(result.catalogSize, 32);
    assert.equal(result.catalogVersion, "2026-10-23.1");
    for (const [category, code, name, productId] of [
      [
        "wine",
        "citrus",
        "클라우디 베이 소비뇽 블랑 2024",
        "cloudy-bay-sb-2024",
      ],
      ["beer", "citrus", "시에라 네바다 페일 에일", "sierra-nevada-pale-ale"],
      ["traditional", "rice_grain", "화요 25", "hwayo-25"],
    ] as const) {
      const c = await sdk.rpc("create_tasting_record", {
        p_operation_id: randomUUID(),
        p_record: {
          enteredName: `합성 ${category}`,
          category,
          revisit: "again",
        },
      });
      assert.equal(c.error, null);
      let d = newTastingDraft(a.user.id, c.data.recordId, category, "light");
      d = setAnswer(d, "nose", {
        status: "answered",
        descriptors: [code],
        intensity: null,
        freeText: "",
      });
      await tastingRepository(sdk).save(
        d,
        randomUUID(),
        c.data.revision,
        composeNote(d),
        false,
      );
      const r = await request(endpoint, a.access_token, {
        action: "recommend",
        photos,
        items: [{ ...item, name, productId }],
      });
      assert.equal(r.status, 200);
      const body = await r.json();
      validateMenuResult(body, [{ ...item, name, productId }]);
      assert.equal(body.recommendations[0].status, "similar");
      assert.ok(
        body.recommendations[0].similar.some((f: { recordIds: string[] }) =>
          f.recordIds.includes(c.data.recordId),
        ),
      );
    }
    let stalePhotoCalls = 0;
    const staleEvidence = await refreshMenuEvidence(result.tasteHash, {
      active: () => true,
      async hash() {
        const context = await sdk.rpc("taste_summary_context");
        assert.equal(context.error, null);
        return context.data.snapshot.hash;
      },
      async photos() {
        stalePhotoCalls++;
        return {};
      },
    });
    assert.equal(staleEvidence.status, "stale");
    assert.equal(stalePhotoCalls, 0);
    const archivedItem = { ...item, productId: "retired-product-id" };
    const archivedPayload = {
      p_id: randomUUID(),
      p_revision: 0,
      p_photos: photos,
      p_items: [archivedItem],
    };
    for (let retry = 0; retry < 2; retry++) {
      const archived = await request(
        "/rest/v1/rpc/save_menu_session",
        a.access_token,
        archivedPayload,
      );
      assert.equal(archived.status, 200);
      assert.equal(await archived.json(), 1);
    }
    assert.equal(
      (
        await request(endpoint, a.access_token, {
          action: "recommend",
          photos,
          items: [archivedItem],
        })
      ).status,
      400,
    );
    const mismatched = await request(endpoint, a.access_token, {
      action: "recommend",
      photos,
      items: [{ ...item, name: "화요 25", productId: "hwayo-41" }],
    });
    assert.equal(mismatched.status, 400);
    const foreignResult = await request(endpoint, b.access_token, {
      action: "recommend",
      photos,
      items: [item],
    });
    assert.deepEqual(
      (await foreignResult.json()).recommendations[0].similar,
      [],
    );
  },
);
