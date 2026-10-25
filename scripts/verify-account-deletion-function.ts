/** Verify the generated artifact on isolated local Supabase, restoring the source even when tests fail. */
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  rmdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
async function main() {
  const root = resolve(process.cwd());
  const entry = join(root, "supabase/functions/delete-account/index.ts");
  const status = JSON.parse(
    execFileSync(
      resolve("node_modules/.bin/supabase"),
      ["status", "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  if (status.API_URL !== "http://127.0.0.1:54321")
    throw new Error("Only isolated local Supabase is supported");
  const lock = join(
    tmpdir(),
    `mogeum-account-deletion-bundle-${createHash("sha256").update(root).digest("hex").slice(0, 12)}.lock`,
  );
  mkdirSync(lock);
  const work = mkdtempSync(join(tmpdir(), "mogeum-account-deletion-verify-"));
  const original = readFileSync(entry);
  const backup = join(work, "source-backup.ts");
  writeFileSync(backup, original, { mode: 0o600 });
  let restored = false;
  try {
    const output = join(work, "index.ts");
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        "scripts/build-account-deletion-function.ts",
        output,
      ],
      { stdio: "inherit" },
    );
    const manifest = JSON.parse(
      readFileSync(`${output}.manifest.json`, "utf8"),
    );
    writeFileSync(entry, readFileSync(output));
    let matched = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const response = await fetch(
          "http://127.0.0.1:54321/functions/v1/delete-account",
          { method: "POST", body: "{}", signal: AbortSignal.timeout(2000) },
        );
        if (
          response.status === 401 &&
          response.headers.get("X-Mogeum-Build") === manifest.buildId
        ) {
          matched = true;
          break;
        }
      } catch {
        /* Wait for the local worker to reload; never print request metadata. */
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!matched)
      throw new Error("Local runtime did not load the deployment artifact");
    console.log(`Verified runtime build: ${manifest.buildId}`);
    const tests = spawnSync(
      process.execPath,
      [
        resolve("node_modules/tsx/dist/cli.mjs"),
        "--test",
        "tests/account-deletion-api.test.ts",
      ],
      {
        stdio: "inherit",
        env: { ...process.env, MOGEUM_TEST_SUPABASE_HTTP: "1" },
        timeout: 120000,
      },
    );
    if (tests.status !== 0)
      throw new Error("Deployment artifact HTTP tests failed");
  } finally {
    try {
      writeFileSync(entry, original);
      restored = readFileSync(entry).equals(original);
    } finally {
      if (restored) rmSync(work, { recursive: true, force: true });
      else
        console.error(
          `Source restoration failed; private backup retained at ${backup}`,
        );
      rmdirSync(lock);
      console.log(`Source entry restored: ${restored}`);
    }
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Deployment verification failed",
  );
  process.exitCode = 1;
});
