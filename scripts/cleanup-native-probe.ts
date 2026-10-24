/** Remove only users identified by an explicit native probe's private manifest in isolated local Supabase. */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Private native probe manifest required");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  if (
    !/^[a-z0-9_-]{1,60}$/i.test(manifest.runId) ||
    !Array.isArray(manifest.userIds) ||
    manifest.userIds.length > 2 ||
    manifest.userIds.some(
      (id: unknown) => typeof id !== "string" || !uuid.test(id),
    )
  )
    throw new Error("Invalid native probe manifest");
  const status = JSON.parse(
    execFileSync(
      resolve("node_modules/.bin/supabase"),
      ["status", "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  if (
    status.API_URL !== "http://127.0.0.1:54321" ||
    typeof status.SERVICE_ROLE_KEY !== "string"
  )
    throw new Error("Expected isolated local Supabase");
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  // Verify every identity before making any deletion. Never select all users or trust a manifest URL.
  const liveIds: string[] = [];
  for (const id of manifest.userIds) {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error?.status === 404) continue;
    if (
      error ||
      !data.user ||
      data.user.user_metadata.mogeum_native_probe !== manifest.runId ||
      !/^native-[0-9a-f-]+@example\.test$/i.test(data.user.email ?? "")
    )
      throw new Error("Probe identity mismatch; no cleanup performed");
    liveIds.push(id);
  }
  for (const id of liveIds) {
    const records = await admin
      .from("tasting_records")
      .delete()
      .eq("user_id", id);
    if (records.error) throw new Error("Probe records cleanup failed");
    const prefix = `${id}/records`;
    const { data: folders, error } = await admin.storage
      .from("record-photos")
      .list(prefix, { limit: 1000 });
    if (error || !folders || folders.length >= 1000)
      throw new Error("Probe storage listing failed");
    const paths: string[] = [];
    for (const folder of folders) {
      if (!uuid.test(folder.name))
        throw new Error("Unexpected probe folder; stop cleanup");
      const files = await admin.storage
        .from("record-photos")
        .list(`${prefix}/${folder.name}`, { limit: 100 });
      if (files.error || !files.data || files.data.length >= 100)
        throw new Error("Probe photo listing failed");
      for (const photo of files.data) {
        if (photo.name !== "photo.jpg")
          throw new Error("Unexpected probe file; stop cleanup");
        paths.push(`${prefix}/${folder.name}/${photo.name}`);
      }
    }
    if (paths.length) {
      const removed = await admin.storage.from("record-photos").remove(paths);
      if (removed.error) throw new Error("Probe storage cleanup failed");
    }
    const entries = await admin
      .from("cellar_entries")
      .delete()
      .eq("user_id", id);
    if (entries.error) throw new Error("Probe entries cleanup failed");
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error) throw new Error("Probe auth cleanup failed");
  }
  console.log(
    `Native probe cleanup completed: ${liveIds.length} synthetic users`,
  );
}
main().catch(() => {
  console.error(
    "Native probe cleanup failed; inspect the private manifest and local project. No credentials were logged.",
  );
  process.exitCode = 1;
});
