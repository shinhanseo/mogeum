/** One named, loopback-only synthetic native run against the approved development project. No service key is sent to the device. */
import { createServer } from "node:http";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
async function main() {
  if (process.env.MOGEUM_VERIFY_MANAGED_DEV !== "1")
    throw Error("EXPLICIT_OPT_IN_REQUIRED");
  process.loadEnvFile(".env");
  const url = "https://vsckzjfgzdpzkzuumldf.supabase.co";
  if (process.env.EXPO_PUBLIC_SUPABASE_URL !== url)
    throw Error("APPROVED_PROJECT_ONLY");
  const credentials = JSON.parse(
    await readFile(
      join(homedir(), ".config/mogeum/credentials/supabase-development.json"),
      "utf8",
    ),
  );
  if (credentials.url !== url || credentials.serviceKey.length < 40)
    throw Error("SERVER_CREDENTIAL_REQUIRED");
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    options = {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    };
  const admin = createClient(url, credentials.serviceKey, options),
    run = randomUUID(),
    nonce = randomUUID(),
    owners: string[] = [];
  const journal = join(
    homedir(),
    ".config/mogeum/credentials/managed-native-menu-journal.json",
  );
  const old = await readFile(journal, "utf8").catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (old) throw Error("PREVIOUS_CLEANUP_REQUIRED");
  async function create() {
    const email = `native-managed-${randomUUID()}@example.test`,
      password = randomUUID() + "Aa1!";
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        mogeum_test_fixture: "native-managed-menu-v1",
        mogeum_test_run: run,
      },
    });
    if (result.error || !result.data.user) throw Error("CREATE_FAILED");
    const owner = result.data.user.id;
    owners.push(owner);
    await writeFile(journal, JSON.stringify({ run, owners }), { mode: 0o600 });
    const client = createClient(url, publicKey, options);
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.session) throw Error("LOGIN_FAILED");
    return { owner, token: login.data.session.access_token, client };
  }
  async function cleanup() {
    for (const owner of owners) {
      const current = await admin.auth.admin.getUserById(owner);
      if (!current.data.user) continue;
      if (
        current.data.user.user_metadata.mogeum_test_run !== run ||
        current.data.user.user_metadata.mogeum_test_fixture !==
          "native-managed-menu-v1"
      )
        throw Error("CLEANUP_TAG_MISMATCH");
      const lease = randomUUID();
      const started = await admin.rpc("begin_account_deletion", {
        p_owner: owner,
        p_token_hash: createHash("sha256").update(randomUUID()).digest("hex"),
        p_lease: lease,
      });
      if (started.error || !started.data) throw Error("CLEANUP_LEASE_FAILED");
      const files = await admin.rpc("account_deletion_files", {
        p_owner: owner,
        p_lease: lease,
      });
      if (files.error) throw Error("CLEANUP_FILES_FAILED");
      if (
        files.data.length &&
        (await admin.storage.from("record-photos").remove(files.data)).error
      )
        throw Error("CLEANUP_BINARY_FAILED");
      if (
        (
          await admin.rpc("purge_account_data", {
            p_owner: owner,
            p_lease: lease,
          })
        ).error
      )
        throw Error("CLEANUP_DB_FAILED");
      if ((await admin.auth.admin.deleteUser(owner)).error)
        throw Error("CLEANUP_AUTH_FAILED");
      if (
        (
          await admin.rpc("finish_account_deletion", {
            p_owner: owner,
            p_lease: lease,
          })
        ).error
      )
        throw Error("CLEANUP_RECEIPT_FAILED");
    }
    await unlink(journal);
  }
  try {
    const a = await create(),
      b = await create();
    const record = await a.client.rpc("create_tasting_record", {
      p_operation_id: randomUUID(),
      p_record: {
        enteredName: "네이티브 통합 합성 기록",
        category: "whisky",
        revisit: "again",
      },
    });
    if (record.error || !record.data?.recordId) throw Error("RECORD_FAILED");
    const payload = JSON.stringify({
      url,
      publicKey,
      run,
      a: { owner: a.owner, token: a.token },
      b: { owner: b.owner, token: b.token },
      recordId: record.data.recordId,
      revision: record.data.revision,
    });
    await writeFile(
      join(
        homedir(),
        ".config/mogeum/credentials/managed-native-menu-link.json",
      ),
      JSON.stringify({ run, nonce }),
      { mode: 0o600 },
    );
    let finishing = false;
    const server = createServer(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      if (req.headers.origin || req.url !== `/run/${nonce}`) {
        res.writeHead(404).end();
        return;
      }
      if (req.method === "GET") {
        res.setHeader("Content-Type", "application/json");
        res.end(payload);
        return;
      }
      if (req.method !== "POST" || finishing) {
        res.writeHead(405).end();
        return;
      }
      finishing = true;
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 16000) throw Error("TOO_LARGE");
        }
        const value = JSON.parse(body);
        if (
          value.run !== run ||
          !["passed", "failed"].includes(value.status) ||
          !Array.isArray(value.passed) ||
          value.passed.some(
            (p: unknown) => typeof p !== "string" || !/^[a-z_]+$/.test(p),
          )
        )
          throw Error("INVALID_REPORT");
        await cleanup();
        const report = {
          checkedAt: new Date().toISOString(),
          platform: value.platform,
          status: value.status,
          phase: value.phase,
          passed: value.passed,
          result: value.result,
          syntheticOnly: true,
          humanAccountChanged: false,
          syntheticCleanupComplete: true,
        };
        await writeFile(
          "/tmp/mogeum-managed-native-menu-result.json",
          JSON.stringify(report, null, 2) + "\n",
          { mode: 0o600 },
        );
        console.log(JSON.stringify(report));
        res.end("ok");
        server.close();
      } catch {
        res.writeHead(503).end();
        console.error("Native report/cleanup failed; journal retained.");
        server.close();
        process.exitCode = 1;
      }
    });
    server.listen(8767, "127.0.0.1", () =>
      console.log(
        "Named managed native menu run ready on loopback port 8767; no credentials logged.",
      ),
    );
    setTimeout(() => {
      void cleanup().then(
        () => {
          server.close();
          console.error("Native run timed out; synthetic accounts cleaned.");
          process.exitCode = 1;
        },
        () => {
          server.close();
          console.error("Cleanup requires recovery from private journal.");
          process.exitCode = 1;
        },
      );
    }, 600000).unref();
  } catch {
    await cleanup();
    throw Error("NATIVE_SETUP_FAILED");
  }
}
main().catch(() => {
  console.error(
    "Managed native setup failed; credentials/identity not logged.",
  );
  process.exitCode = 1;
});
