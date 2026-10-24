import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
test(
  "native probe cleanup verifies all users before deleting and only accepts the named local run",
  {
    skip:
      process.env.MOGEUM_TEST_SUPABASE_HTTP !== "1"
        ? "Needs isolated local Supabase HTTP services"
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
    const authOptions = {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    };
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: authOptions,
    });
    const directory = mkdtempSync(join(tmpdir(), "mogeum-native-cleanup-"));
    const file = join(directory, "private-manifest.json");
    const ids: string[] = [];
    const runA = `cleanup-a-${randomUUID()}`,
      runB = `cleanup-b-${randomUUID()}`;
    const signup = async (run: string) => {
      const client = createClient(status.API_URL, status.ANON_KEY, {
        auth: authOptions,
      });
      const { data, error } = await client.auth.signUp({
        email: `native-${randomUUID()}@example.test`,
        password: `${randomUUID()}Aa1!`,
        options: { data: { mogeum_native_probe: run } },
      });
      assert.equal(error, null);
      assert.ok(data.user);
      ids.push(data.user.id);
      return data.user.id;
    };
    const execute = (runId: string, userIds: string[]) => {
      writeFileSync(file, JSON.stringify({ runId, userIds }), { mode: 0o600 });
      return execFileSync(
        process.execPath,
        [
          resolve("node_modules/tsx/dist/cli.mjs"),
          "scripts/cleanup-native-probe.ts",
          file,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    };
    try {
      const a = await signup(runA),
        b = await signup(runB);
      assert.throws(() => execute(runA, [a, b]));
      assert.equal(
        (await admin.auth.admin.getUserById(a)).data.user?.id,
        a,
        "Valid first identity must survive a later marker mismatch",
      );
      assert.equal((await admin.auth.admin.getUserById(b)).data.user?.id, b);
      assert.match(execute(runA, [a]), /1 synthetic users/);
      assert.match(
        execute(runA, [a]),
        /0 synthetic users/,
        "Already deleted probe identities are safe to replay",
      );
      assert.equal((await admin.auth.admin.getUserById(a)).data.user, null);
      assert.equal(
        (await admin.auth.admin.getUserById(b)).data.user?.id,
        b,
        "Another run remains untouched",
      );
      assert.match(execute(runB, [b]), /1 synthetic users/);
    } finally {
      for (const id of ids) await admin.auth.admin.deleteUser(id);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
