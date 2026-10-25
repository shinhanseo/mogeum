/** Explicit Mogeum development opt-in; only freshly created/tagged synthetic users may be deleted. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
async function main() {
  assert.equal(process.env.MOGEUM_VERIFY_MANAGED_DEV, "1");
  process.loadEnvFile(".env");
  const root = join(homedir(), ".config/mogeum/credentials");
  const config = JSON.parse(
    await readFile(join(root, "supabase-development.json"), "utf8"),
  );
  const base = "https://vsckzjfgzdpzkzuumldf.supabase.co";
  assert.equal(config.url, base);
  assert.equal(process.env.EXPO_PUBLIC_SUPABASE_URL, base);
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  assert.ok(key && config.serviceKey);
  const journal = join(root, "managed-deletion-verification-journal.json");
  try {
    await readFile(journal);
    throw Error("UNFINISHED_RUN");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const admin = createClient(base, config.serviceKey, options),
    run = randomUUID();
  const fixtures: { owner: string; token: string; path: string }[] = [];
  const passed: string[] = [];
  let failed = false;
  const call = (
    name: string,
    token?: string,
    body: unknown = { confirm: true },
  ) =>
    fetch(`${base}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
  const record = async () => {
    const email = `mogeum-delete-${randomUUID()}@example.test`,
      password = randomUUID() + "Aa1!";
    const made = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        mogeum_test_fixture: "managed-deletion-v1",
        mogeum_test_run: run,
      },
    });
    assert.equal(made.error, null);
    const owner = made.data.user!.id;
    const fixture = {
      owner,
      token: "",
      path: `${owner}/records/${randomUUID()}/photo.png`,
    };
    fixtures.push(fixture);
    await writeFile(
      journal,
      JSON.stringify({ run, owners: fixtures.map((f) => f.owner) }),
      { mode: 0o600 },
    );
    const client = createClient(base, key, options);
    const login = await client.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null);
    fixture.token = login.data.session!.access_token;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=",
      "base64",
    );
    assert.equal(
      (
        await client.storage
          .from("record-photos")
          .upload(fixture.path, png, { contentType: "image/png" })
      ).error,
      null,
    );
    assert.equal(
      (
        await client.rpc("create_tasting_record", {
          p_operation_id: randomUUID(),
          p_record: {
            enteredName: "Synthetic deletion verification",
            category: "whisky",
            photo: { storagePath: fixture.path, width: 1, height: 1 },
          },
        })
      ).error,
      null,
    );
    return { ...fixture, client };
  };
  const verifyTag = async (owner: string) => {
    const found = await admin.auth.admin.getUserById(owner);
    if (found.error?.status === 404) return false;
    assert.equal(found.error, null);
    assert.equal(
      found.data.user?.user_metadata.mogeum_test_fixture,
      "managed-deletion-v1",
    );
    assert.equal(found.data.user?.user_metadata.mogeum_test_run, run);
    return true;
  };
  try {
    assert.equal((await call("delete-account")).status, 401);
    assert.equal((await call("provider-credentials")).status, 401);
    passed.push("unauthenticated_requests_rejected");
    const a = await record(),
      b = await record();
    passed.push("real_auth_storage_records_created");
    assert.equal(
      (
        await call("provider-credentials", a.token, {
          provider: "google",
          refreshToken: "synthetic-no-provider-token",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("provider-credentials", a.token, {
          provider: "apple",
          refreshToken: "synthetic-no-provider-token",
        })
      ).status,
      403,
    );
    passed.push("unlinked_identity_capture_rejected_before_provider_call");
    assert.equal(
      (
        await call("delete-account", a.token, {
          confirm: true,
          userId: b.owner,
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("delete-account", a.token, { confirm: false })).status,
      400,
    );
    passed.push("confirmation_and_caller_identity_guards");
    await verifyTag(a.owner);
    const deletion = await call("delete-account", a.token);
    assert.equal(deletion.status, 200);
    assert.deepEqual(await deletion.json(), { state: "complete" });
    assert.ok((await admin.auth.admin.getUserById(a.owner)).error);
    assert.ok(
      (await admin.storage.from("record-photos").download(a.path)).error,
    );
    const remaining = await admin
      .from("tasting_records")
      .select("id")
      .eq("user_id", a.owner);
    assert.equal(remaining.error, null);
    assert.deepEqual(remaining.data, []);
    passed.push("owner_auth_binary_and_records_deleted");
    assert.equal(await verifyTag(b.owner), true);
    assert.equal(
      (await b.client.storage.from("record-photos").download(b.path)).error,
      null,
    );
    assert.equal(
      (await b.client.from("tasting_records").select("id")).data?.length,
      1,
    );
    passed.push("other_owner_preserved");
    const replay = await call("delete-account", a.token);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), { state: "complete" });
    passed.push("deleted_session_receipt_replay");
  } catch {
    failed = true;
  } finally {
    let cleaned = true;
    for (const f of fixtures)
      try {
        if (!(await verifyTag(f.owner))) continue;
        const response = await call("delete-account", f.token);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { state: "complete" });
      } catch {
        cleaned = false;
      }
    if (cleaned) await unlink(journal).catch(() => {});
    const report = {
      checkedAt: new Date().toISOString(),
      projectRef: "vsckzjfgzdpzkzuumldf",
      syntheticOnly: true,
      humanAccountChanged: false,
      passed,
      success: !failed && cleaned,
      syntheticCleanupComplete: cleaned,
      actualProviderGrantRevoked: false,
    };
    const output =
      process.argv[2] ?? "/tmp/mogeum-managed-deletion-report.json";
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(JSON.stringify(report));
    if (failed || !cleaned) process.exitCode = 1;
  }
}
main().catch(() => {
  console.error(
    "Managed deletion verification stopped; no credentials or response bodies logged.",
  );
  process.exitCode = 1;
});
