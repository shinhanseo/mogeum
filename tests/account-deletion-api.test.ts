import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

test(
  "account deletion HTTP removes only the verified owner binary, records and Auth; the old token safely acknowledges a lost response",
  {
    skip:
      process.env.MOGEUM_TEST_SUPABASE_HTTP !== "1"
        ? "Needs disposable loopback Auth/Storage/Edge services"
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
    ) as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
    assert.equal(status.API_URL, "http://127.0.0.1:54321");
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const created: string[] = [];
    const make = async () => {
      const email = `delete-fixture-${randomUUID()}@example.test`,
        password = randomUUID() + "Aa1!";
      const user = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { test_fixture: "account-deletion" },
      });
      assert.equal(user.error, null);
      const owner = user.data.user!.id;
      created.push(owner);
      const client = createClient(status.API_URL, status.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const login = await client.auth.signInWithPassword({ email, password });
      assert.equal(login.error, null);
      const operation = randomUUID(),
        path = `${owner}/records/${operation}/photo.png`;
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=",
        "base64",
      );
      assert.equal(
        (
          await client.storage
            .from("record-photos")
            .upload(path, png, { contentType: "image/png" })
        ).error,
        null,
      );
      const record = await client.rpc("create_tasting_record", {
        p_operation_id: operation,
        p_record: {
          enteredName: "Synthetic deletion fixture",
          category: "whisky",
          photo: { storagePath: path, width: 1, height: 1 },
        },
      });
      assert.equal(record.error, null);
      return { owner, client, token: login.data.session!.access_token, path };
    };
    const post = (token?: string, body: unknown = { confirm: true }) =>
      fetch(`${status.API_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          apikey: status.ANON_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55000),
      });
    try {
      const a = await make(),
        b = await make();
      assert.equal((await post()).status, 401);
      assert.equal(
        (await post(a.token, { confirm: true, userId: b.owner })).status,
        400,
      );
      assert.equal((await post(a.token, { confirm: false })).status, 400);
      assert.equal((await admin.auth.admin.getUserById(a.owner)).error, null);
      const response = await post(a.token);
      assert.equal(
        response.status,
        200,
        `Delete endpoint: HTTP ${response.status}`,
      );
      assert.deepEqual(await response.json(), { state: "complete" });
      assert.ok((await admin.auth.admin.getUserById(a.owner)).error);
      assert.ok(
        (await admin.storage.from("record-photos").download(a.path)).error,
        "A physical binary is gone",
      );
      const remaining = await admin
        .from("tasting_records")
        .select("id")
        .eq("user_id", a.owner);
      assert.equal(remaining.error, null);
      assert.deepEqual(remaining.data, []);
      const entries = await admin
        .from("cellar_entries")
        .select("id")
        .eq("user_id", a.owner);
      assert.equal(entries.error, null);
      assert.deepEqual(entries.data, []);
      assert.equal(
        (await admin.auth.admin.getUserById(b.owner)).error,
        null,
        "B Auth remains",
      );
      assert.equal(
        (await b.client.storage.from("record-photos").download(b.path)).error,
        null,
        "B physical binary remains",
      );
      assert.equal(
        (await b.client.from("tasting_records").select("id")).data?.length,
        1,
        "B record remains",
      );
      const retry = await post(a.token);
      assert.equal(retry.status, 200);
      assert.deepEqual(await retry.json(), { state: "complete" });
      assert.equal((await post("unverified-token")).status, 401);
    } finally {
      // Only freshly created, explicitly tagged fixtures are eligible for cleanup.
      for (const owner of created) {
        const found = await admin.auth.admin.getUserById(owner);
        if (!found.data.user) continue;
        assert.equal(
          found.data.user.user_metadata.test_fixture,
          "account-deletion",
        );
        const lease = randomUUID(),
          hash = "c".repeat(64);
        const begin = await admin.rpc("begin_account_deletion", {
          p_owner: owner,
          p_token_hash: hash,
          p_lease: lease,
        });
        assert.equal(begin.error, null);
        if (begin.data === true) {
          const files = await admin.rpc("account_deletion_files", {
            p_owner: owner,
            p_lease: lease,
          });
          assert.equal(files.error, null);
          if (files.data?.length)
            assert.equal(
              (await admin.storage.from("record-photos").remove(files.data))
                .error,
              null,
            );
          assert.equal(
            (
              await admin.rpc("purge_account_data", {
                p_owner: owner,
                p_lease: lease,
              })
            ).error,
            null,
          );
          assert.equal((await admin.auth.admin.deleteUser(owner)).error, null);
          assert.equal(
            (
              await admin.rpc("finish_account_deletion", {
                p_owner: owner,
                p_lease: lease,
              })
            ).error,
            null,
          );
        }
      }
    }
  },
);
