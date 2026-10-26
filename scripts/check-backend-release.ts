import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BACKEND_FUNCTIONS,
  backendTarget,
  backendMetadataProblems,
  migrationLedgerProblems,
} from "../src/lib/backend-release";
function cliJson(args: string[]) {
  return JSON.parse(
    execFileSync("npx", ["supabase", ...args, "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 45000,
    }),
  );
}
async function main() {
  try {
    const targetName = process.argv[2] ?? "development";
    const target = backendTarget(targetName);
    const functions = cliJson([
      "functions",
      "list",
      "--project-ref",
      target.ref,
    ]);
    const secrets = cliJson(["secrets", "list", "--project-ref", target.ref]);
    if (!Array.isArray(functions) || !Array.isArray(secrets))
      throw Error("Unexpected CLI metadata");
    const issues = backendMetadataProblems(functions, secrets);
    const probes = await Promise.all(
      BACKEND_FUNCTIONS.map(async (name) => {
        try {
          const r = await fetch(`${target.url}/functions/v1/${name}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: "Bearer invalid-beta-audit-token",
            },
            body:
              name === "delete-account"
                ? JSON.stringify({ confirm: true })
                : "{}",
            signal: AbortSignal.timeout(15000),
          });
          await r.body?.cancel();
          if (r.status !== 401) issues.push(`AUTH_BOUNDARY_FAILED:${name}`);
          return { function: name, status: r.status };
        } catch {
          issues.push(`AUTH_BOUNDARY_UNAVAILABLE:${name}`);
          return { function: name, status: null };
        }
      }),
    );
    const migrations = readdirSync("supabase/migrations")
      .filter((n) => /^\d+_.+\.sql$/.test(n))
      .sort()
      .map((name) => ({
        name,
        sha256: createHash("sha256")
          .update(readFileSync(join("supabase/migrations", name)))
          .digest("hex"),
      }));
    if (
      readFileSync("supabase/.temp/project-ref", "utf8").trim() !== target.ref
    )
      throw Error("LINKED_PROJECT_MISMATCH");
    let ledgerIssues: string[];
    try {
      const history = cliJson(["migration", "list", "--linked"]);
      if (!Array.isArray(history.migrations))
        throw Error("Unexpected migration metadata");
      ledgerIssues = migrationLedgerProblems(
        migrations.map((m) => m.name.split("_")[0]),
        history.migrations,
      );
    } catch {
      ledgerIssues = ["MIGRATION_LEDGER_UNAVAILABLE"];
    }
    console.log(
      JSON.stringify(
        {
          target: targetName,
          projectRef: target.ref,
          metadataAndAuthBoundaryReady: !issues.length,
          migrationLedgerAligned: !ledgerIssues.length,
          automaticDeploymentReady: !issues.length && !ledgerIssues.length,
          ledgerIssues,
          // Secret values, function download paths, account IDs and CLI stderr are never logged.
          migrations,
          probes,
          issues,
          scope:
            "read-only metadata and invalid-token requests; not a functional login/DB/AI/deletion smoke test",
        },
        null,
        2,
      ),
    );
    if (issues.length || ledgerIssues.length) process.exitCode = 1;
  } catch {
    console.error(
      "BACKEND_AUDIT_FAILED: target/authentication/network must be checked; raw CLI output suppressed.",
    );
    process.exitCode = 1;
  }
}
void main();
