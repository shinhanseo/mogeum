/** Simulate a second session changing one named synthetic user's bookmark. Local test server only. */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { products } from "../supabase/functions/_shared/product-catalog";

async function main() {
  const [file, productId, savedRaw, output] = process.argv.slice(2);
  if (!file || !output || !products.some((p) => p.id === productId) ||
      !["true", "false"].includes(savedRaw))
    throw new Error("Explicit synthetic run, canonical product, state and report required");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  if (!/^[a-z0-9_-]{1,60}$/i.test(manifest.runId) ||
      !Array.isArray(manifest.userIds) || manifest.userIds.length !== 1 ||
      !/^[0-9a-f-]{36}$/i.test(manifest.userIds[0]))
    throw new Error("Synthetic manifest required");
  const status = JSON.parse(execFileSync(resolve("node_modules/.bin/supabase"),
    ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  if (status.API_URL !== "http://127.0.0.1:54321" ||
      !status.PUBLISHABLE_KEY?.startsWith("sb_publishable_"))
    throw new Error("Isolated local project required");
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  const owner = manifest.userIds[0];
  const identity = await admin.auth.admin.getUserById(owner);
  if (identity.error || identity.data.user?.user_metadata.mogeum_native_probe !== manifest.runId ||
      !/^native-[0-9a-f-]+@example\.test$/i.test(identity.data.user.email ?? ""))
    throw new Error("Synthetic identity mismatch");
  // Issue an independent session for this disposable identity, then exercise the authenticated RPC.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: identity.data.user.email! });
  if (link.error || !link.data.properties.hashed_token) throw new Error("Synthetic session failed");
  const client = createClient(status.API_URL, status.PUBLISHABLE_KEY, options);
  try {
    const login = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
    if (login.error || login.data.user?.id !== owner) throw new Error("Synthetic session mismatch");
    const previous = await client.from("drink_wishlist").select("revision").eq("product_id", productId).maybeSingle();
    if (previous.error) throw new Error("Read failed");
    const expectedRevision = previous.data?.revision ?? 0;
    const result = await client.rpc("set_drink_wishlist", {
      p_operation_id: randomUUID(), p_product_id: productId,
      p_saved: savedRaw === "true", p_expected_revision: expectedRevision,
    });
    if (result.error || result.data?.productId !== productId ||
        result.data?.saved !== (savedRaw === "true") || result.data?.revision !== expectedRevision + 1)
      throw new Error("Mutation failed");
    writeFileSync(output, JSON.stringify({ synthetic: true, runId: manifest.runId,
      secondSession: true, productId, saved: result.data.saved, revision: result.data.revision,
      checkedAt: new Date().toISOString() }, null, 2) + "\n");
    console.log("Verified independent local synthetic bookmark mutation");
  } finally {
    // Do not revoke the native app's separate session.
    await client.auth.signOut({ scope: "local" });
  }
}
main().catch(() => {
  console.error("Local synthetic mutation failed; no identities or credentials were logged.");
  process.exitCode = 1;
});
