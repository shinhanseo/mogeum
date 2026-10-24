/** Read-only assertions for one explicitly named synthetic native UI run. Never print identities or credentials. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseWishlist } from "../src/features/discovery/wishlist";
async function main() {
  const [file, output, expectedRecordsRaw, expectedSavedRaw] =
    process.argv.slice(2);
  if (!file || !output)
    throw new Error("Explicit manifest and output required");
  const expectedRecords = Number(expectedRecordsRaw),
    expectedSaved = Number(expectedSavedRaw);
  if (
    expectedRecordsRaw === undefined ||
    expectedSavedRaw === undefined ||
    !Number.isSafeInteger(expectedRecords) ||
    expectedRecords < 0 ||
    !Number.isSafeInteger(expectedSaved) ||
    expectedSaved < 0
  )
    throw new Error("Expected counts required");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  if (
    !/^[a-z0-9_-]{1,60}$/i.test(manifest.runId) ||
    !Array.isArray(manifest.userIds) ||
    manifest.userIds.length !== 1 ||
    !/^[0-9a-f-]{36}$/i.test(manifest.userIds[0])
  )
    throw new Error("Synthetic run required");
  const status = JSON.parse(
    execFileSync(
      resolve("node_modules/.bin/supabase"),
      ["status", "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  if (status.API_URL !== "http://127.0.0.1:54321")
    throw new Error("Local project required");
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const owner = manifest.userIds[0],
    identity = await admin.auth.admin.getUserById(owner);
  if (
    identity.error ||
    identity.data.user?.user_metadata.mogeum_native_probe !== manifest.runId ||
    !/^native-[0-9a-f-]+@example\.test$/i.test(identity.data.user.email ?? "")
  )
    throw new Error("Synthetic identity mismatch");
  const [records, entries, wishlist] = await Promise.all([
    admin
      .from("tasting_records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", owner),
    admin
      .from("cellar_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", owner),
    admin
      .from("drink_wishlist")
      .select("product_id,saved,revision")
      .eq("user_id", owner),
  ]);
  if (
    records.error ||
    entries.error ||
    wishlist.error ||
    !wishlist.data ||
    records.count !== expectedRecords ||
    entries.count === null ||
    entries.count > expectedRecords
  )
    throw new Error("Unexpected persisted state");
  const state = parseWishlist(
    wishlist.data.map((r) => ({
      productId: r.product_id,
      saved: r.saved,
      revision: r.revision,
    })),
  );
  if (state.filter((r) => r.saved).length !== expectedSaved)
    throw new Error("Unexpected saved count");
  const report = {
    synthetic: true,
    runId: manifest.runId,
    recordCount: records.count,
    entryCount: entries.count,
    wishlist: state,
    checkedAt: new Date().toISOString(),
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `Verified synthetic UI state: records=${records.count}, saved=${expectedSaved}`,
  );
}
main().catch(() => {
  console.error(
    "Local UI state verification failed; no credentials were logged.",
  );
  process.exitCode = 1;
});
