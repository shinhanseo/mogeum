/** Opt-in integration check on the approved development project; synthetic account only. */
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { newTastingDraft, setAnswer } from "../src/features/tasting/draft";
import { composeNote } from "../src/features/tasting/answers";
import { tastingRepository } from "../src/features/tasting/repository";
import { parseDiscoveryResult } from "../src/features/discovery/contract";
import { SHARED_CATALOG_VERSION } from "../supabase/functions/_shared/catalog-contract";

async function main() {
  if (process.env.MOGEUM_VERIFY_MANAGED_DEV !== "1") throw Error("EXPLICIT_DEV_OPT_IN_REQUIRED");
  process.loadEnvFile(".env");
  const url = "https://vsckzjfgzdpzkzuumldf.supabase.co";
  const config = JSON.parse(await readFile(`${homedir()}/.config/mogeum/credentials/supabase-development.json`, "utf8"));
  if (config.url !== url || process.env.EXPO_PUBLIC_SUPABASE_URL !== url || !config.serviceKey) throw Error("DEV_PROJECT_MISMATCH");
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const options = {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}};
  const admin = createClient(url, config.serviceKey, options), client = createClient(url, key, options);
  const journal = `${homedir()}/.config/mogeum/credentials/weekly-verification-journal.json`;
  if (await readFile(journal, "utf8").catch(e => {if(e.code === "ENOENT") return null; throw e;})) throw Error("CLEANUP_REQUIRED");
  const report: Record<string, unknown> = {checkedAt: new Date().toISOString(), syntheticOnly: true, humanAccountChanged: false};
  let owner: string | undefined;
  const ensure = (ok: unknown, label: string) => {if (!ok) throw Error(label);};
  try {
    const email = `mogeum-weekly-${randomUUID()}@example.test`, password = randomUUID()+"Aa1!";
    const created = await admin.auth.admin.createUser({email, password, email_confirm: true, user_metadata: {mogeum_test_fixture: "weekly-verification"}});
    ensure(!created.error && created.data.user, "SYNTHETIC_CREATE_FAILED");
    owner = created.data.user!.id;
    await writeFile(journal, JSON.stringify({owner}), {mode: 0o600});
    const login = await client.auth.signInWithPassword({email,password});
    ensure(!login.error && login.data.session, "SYNTHETIC_LOGIN_FAILED");
    const request = async (weekly = true) => {
      const response = await fetch(`${url}/functions/v1/next-drinks`, {method: "POST", headers: {apikey:key, Authorization:`Bearer ${login.data.session!.access_token}`, "Content-Type":"application/json"}, body:JSON.stringify({catalogVersion:SHARED_CATALOG_VERSION,...(weekly?{recommendationVersion:"weekly-selection-v1"}:{})}),signal:AbortSignal.timeout(55000)});
      const body = await response.json();
      if (!response.ok) throw Error(`ENDPOINT_${response.status}_${typeof body.code === "string" ? body.code.replace(/[^A-Z_]/g, "").slice(0,80) : "ERROR"}`);
      return parseDiscoveryResult(body);
    };
    const empty = await request();
    ensure(empty.generation?.state === "insufficient" && !empty.modelUsed, "EMPTY_MUST_NOT_CALL_MODEL");
    report.emptyState = empty.generation?.state;
    const saved = await client.rpc("create_tasting_record", {p_operation_id:randomUUID(),p_record:{enteredName:"합성 위스키 기록",category:"whisky",revisit:"again"}});
    ensure(!saved.error && saved.data?.recordId, "SYNTHETIC_RECORD_FAILED");
    let draft = newTastingDraft(owner, saved.data.recordId, "whisky", "light");
    draft = setAnswer(draft,"nose",{status:"answered",descriptors:["fruit"],intensity:null,freeText:""});
    await tastingRepository(client).save(draft,randomUUID(),saved.data.revision,composeNote(draft),false);
    const selected = await request();
    ensure(selected.generation?.state === "generated" && selected.modelUsed && selected.recommendations.length, "ACTUAL_GENERATION_FAILED");
    const cached = await request();
    ensure(cached.generation?.state === "cached" && cached.generation.generatedAt === selected.generation!.generatedAt && cached.generation.nextGenerationAt === selected.generation!.nextGenerationAt, "CACHE_RECEIPT_CHANGED");
    ensure(JSON.stringify(cached.recommendations) === JSON.stringify(selected.recommendations), "CACHE_SELECTION_CHANGED");
    report.generated = {state:selected.generation?.state,recommendationCount:selected.recommendations.length,modelUsed:selected.modelUsed};
    report.cached = {state:cached.generation?.state,sameReceipt:true,sameSelection:true};
    const changed = await client.rpc("create_tasting_record", {p_operation_id:randomUUID(),p_record:{enteredName:"합성 변경 기록",category:"beer",revisit:"okay"}});
    ensure(!changed.error, "SYNTHETIC_CHANGE_FAILED");
    const invalidated = await request();
    ensure(invalidated.generation?.state === "invalidated" && !invalidated.modelUsed && !invalidated.recommendations.length, "STALE_RESULT_EXPOSED");
    report.invalidated = {state:invalidated.generation?.state,recommendationCount:0,modelUsed:false};
    const legacy = await request(false);
    ensure(legacy.method === "evidence-rules-v1" && !legacy.modelUsed, "LEGACY_REGRESSION");
    report.legacyCompatible = true;
  } finally {
    if (owner) {
      const removed = await admin.auth.admin.deleteUser(owner);
      if (removed.error) throw Error("SYNTHETIC_CLEANUP_FAILED_JOURNAL_RETAINED");
      await unlink(journal);
      report.syntheticAccountDeleted = true;
    }
    await mkdir("artifacts/verification",{recursive:true});
    await writeFile("artifacts/verification/managed-weekly.json",JSON.stringify(report,null,2)+"\n");
  }
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error instanceof Error ? error.message : "WEEKLY_VERIFICATION_FAILED");process.exitCode=1;});
