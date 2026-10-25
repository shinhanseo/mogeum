import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { deleteAccount } from "../_shared/account-deletion.ts";
import { readMenuBody } from "../_shared/menu-body.ts";
declare const __MOGEUM_BUILD_ID__: string | undefined;
const buildId =
  typeof __MOGEUM_BUILD_ID__ === "string"
    ? __MOGEUM_BUILD_ID__
    : "source-development";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      "X-Mogeum-Build": buildId,
    },
  });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return reply({ code: "UNAUTHENTICATED" }, 401);
  let body: unknown;
  try {
    body = JSON.parse(await readMenuBody(request, 128));
  } catch {
    return reply({ code: "INVALID_REQUEST" }, 400);
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    (body as { confirm?: unknown }).confirm !== true
  )
    return reply({ code: "CONFIRMATION_REQUIRED" }, 400);
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({ code: "NOT_CONFIGURED" }, 503);
  const signal = AbortSignal.timeout(45000);
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal }) },
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw Error("DELETION_STEP_FAILED");
    return data;
  }
  try {
    const result = await deleteAccount(
      {
        completed: async () =>
          (await rpc("completed_account_deletion", { p_token_hash: hash })) ===
          true,
        authenticate: async () => {
          const { data, error } = await admin.auth.getUser(token);
          return error ? null : (data.user?.id ?? null);
        },
        begin: async (owner, lease) =>
          (await rpc("begin_account_deletion", {
            p_owner: owner,
            p_token_hash: hash,
            p_lease: lease,
          })) === true,
        files: async (owner, lease) => {
          const value = await rpc("account_deletion_files", {
            p_owner: owner,
            p_lease: lease,
          });
          if (!Array.isArray(value) || value.some((p) => typeof p !== "string"))
            throw Error("INVALID_FILES");
          return value;
        },
        remove: async (paths) => {
          const { error } = await admin.storage
            .from("record-photos")
            .remove(paths);
          if (error) throw Error("PHOTO_DELETE_FAILED");
        },
        purge: async (owner, lease) => {
          await rpc("purge_account_data", { p_owner: owner, p_lease: lease });
        },
        deleteAuth: async (owner) => {
          const { error } = await admin.auth.admin.deleteUser(owner);
          if (error) throw Error("AUTH_DELETE_FAILED");
        },
        finish: async (owner, lease) => {
          await rpc("finish_account_deletion", {
            p_owner: owner,
            p_lease: lease,
          });
        },
        release: async (owner, lease) => {
          await rpc("release_account_deletion", {
            p_owner: owner,
            p_lease: lease,
          });
        },
      },
      crypto.randomUUID(),
    );
    return reply(result);
  } catch (error) {
    return reply(
      {
        code:
          error instanceof Error && error.message === "UNAUTHENTICATED"
            ? "UNAUTHENTICATED"
            : "DELETION_RETRY_REQUIRED",
      },
      error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 503,
    );
  }
});
