/** Exercise a second authenticated session of one explicitly named disposable native UI run. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
async function main() {
  const [file, action, privateState, reportFile] = process.argv.slice(2);
  if (
    !file ||
    !privateState ||
    !reportFile ||
    !["create", "update", "delete"].includes(action)
  )
    throw Error("Explicit synthetic run and action required");
  if (
    new Set([file, privateState, reportFile].map((p) => resolve(p))).size !==
      3 ||
    (action === "create" && existsSync(privateState))
  )
    throw Error("Use separate files and a new record state");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  if (
    !/^[a-z0-9_-]{1,60}$/i.test(manifest.runId) ||
    manifest.userIds?.length !== 1 ||
    !/^[0-9a-f-]{36}$/i.test(manifest.userIds[0])
  )
    throw Error("Synthetic manifest required");
  const config = JSON.parse(
    execFileSync(
      resolve("node_modules/.bin/supabase"),
      ["status", "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  if (
    config.API_URL !== "http://127.0.0.1:54321" ||
    !config.PUBLISHABLE_KEY?.startsWith("sb_publishable_")
  )
    throw Error("Local test project required");
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
  const owner = manifest.userIds[0];
  const identity = await admin.auth.admin.getUserById(owner);
  if (
    identity.error ||
    identity.data.user?.user_metadata.mogeum_native_probe !== manifest.runId ||
    !/^native-[0-9a-f-]+@example\.test$/i.test(identity.data.user.email ?? "")
  )
    throw Error("Synthetic identity mismatch");
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: identity.data.user.email!,
  });
  if (link.error || !link.data.properties.hashed_token)
    throw Error("Synthetic login failed");
  const client = createClient(config.API_URL, config.PUBLISHABLE_KEY, options);
  try {
    const login = await client.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: "magiclink",
    });
    if (login.error || login.data.user?.id !== owner)
      throw Error("Synthetic session mismatch");
    if (action === "create") {
      const result = await client.rpc("create_tasting_record", {
        p_operation_id: randomUUID(),
        p_record: {
          enteredName: "합성 복귀 확인",
          category: "whisky",
          revisit: "again",
        },
        p_entry_id: null,
      });
      if (result.error || !result.data?.recordId)
        throw Error("Synthetic create failed");
      writeFileSync(
        privateState,
        JSON.stringify({
          runId: manifest.runId,
          recordId: result.data.recordId,
        }),
      );
    } else {
      const stored = JSON.parse(readFileSync(privateState, "utf8"));
      if (
        stored.runId !== manifest.runId ||
        !/^[0-9a-f-]{36}$/i.test(stored.recordId)
      )
        throw Error("Synthetic record required");
      const current = await client
        .from("tasting_records")
        .select("id,revision,entered_name")
        .eq("user_id", owner)
        .eq("id", stored.recordId)
        .single();
      if (
        current.error ||
        !current.data?.entered_name?.startsWith("합성 복귀 확인")
      )
        throw Error("Synthetic record mismatch");
      if (action === "update") {
        const result = await client.rpc("edit_tasting_record", {
          p_record_id: stored.recordId,
          p_expected_revision: current.data.revision,
          p_patch: { enteredName: "합성 복귀 확인 · 수정됨" },
        });
        if (result.error) throw Error("Synthetic update failed");
      } else {
        const result = await client
          .from("tasting_records")
          .delete()
          .eq("user_id", owner)
          .eq("id", stored.recordId)
          .eq("revision", current.data.revision)
          .select("id");
        if (result.error || result.data?.length !== 1)
          throw Error("Synthetic deletion failed");
      }
    }
    writeFileSync(
      reportFile,
      JSON.stringify(
        {
          synthetic: true,
          runId: manifest.runId,
          secondSession: true,
          action,
          verified: true,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("Verified named local synthetic record mutation");
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}
main().catch(() => {
  console.error(
    "Local synthetic mutation failed; no identities or credentials logged.",
  );
  process.exitCode = 1;
});
