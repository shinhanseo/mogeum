/** Opt-in integration check on the approved development project; synthetic account only. */
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { newTastingDraft, setAnswer } from "../src/features/tasting/draft";
import { composeNote } from "../src/features/tasting/answers";
import { tastingRepository } from "../src/features/tasting/repository";
import { validateMenuResult } from "../src/features/menu/result-contract";
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
  const journal = `${homedir()}/.config/mogeum/credentials/researched-product-verification-journal.json`;
  if (await readFile(journal, "utf8").catch(e => {if(e.code === "ENOENT") return null; throw e;})) throw Error("CLEANUP_REQUIRED");
  const report: Record<string, unknown> = {checkedAt: new Date().toISOString(), syntheticOnly: true, humanAccountChanged: false};
  let owner: string | undefined;
  const ensure = (ok: unknown, label: string) => {if (!ok) throw Error(label);};
  try {
    const email = `mogeum-menu-selection-${randomUUID()}@example.test`, password = randomUUID()+"Aa1!";
    const created = await admin.auth.admin.createUser({email, password, email_confirm: true, user_metadata: {mogeum_test_fixture: "researched-product-verification"}});
    ensure(!created.error && created.data.user, "SYNTHETIC_CREATE_FAILED");
    owner = created.data.user!.id;
    await writeFile(journal, JSON.stringify({owner}), {mode: 0o600});
    const login = await client.auth.signInWithPassword({email,password});
    ensure(!login.error && login.data.session, "SYNTHETIC_LOGIN_FAILED");
    const photoId = randomUUID();
    const photos = [{id:photoId,imageRevision:1,width:1200,height:1600,engine:"apple-vision-v1",lines:["글렌리벳 12년 30ml 15,000원","부나하벤 12년 30ml 14,000원","합성 미등록 주류 30ml 13,000원"].map((text,index)=>({id:`${photoId}:1:${index}`,text,confidence:0.9,polygon:[{x:0.1,y:0.1+index*0.1},{x:0.9,y:0.1+index*0.1},{x:0.9,y:0.15+index*0.1},{x:0.1,y:0.15+index*0.1}]}))}];
    const call = async (body:Record<string,unknown>) => {
      const response = await fetch(`${url}/functions/v1/menu-recommend`, {method:"POST",headers:{apikey:key,Authorization:`Bearer ${login.data.session!.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({...body,photos,catalogVersion:SHARED_CATALOG_VERSION}),signal:AbortSignal.timeout(55000)});
      const data=await response.json();if(!response.ok)throw Error(`MENU_ENDPOINT_${response.status}`);return data;
    };
    const parsed = await call({action:"parse"});
    const items = parsed.items.map((item:{id:string;name:string}) => ({...item,confirmed:true,productId: parsed.catalog.find((p:{id:string})=>item.name.includes("글렌리벳") ? p.id === "glenlivet-12" : item.name.includes("부나하벤") ? p.id === "bunnahabhain-12-463" : false)?.id ?? null}));
    ensure(items.length===3,"MENU_PARSE_COUNT");
    const request=async(gemini=true)=>validateMenuResult(await call({action:"recommend",items,...(gemini?{recommendationVersion:"menu-selection-v1"}:{})}),items);
    const empty=await request();ensure(empty.selectionState==="insufficient"&&!empty.modelUsed,"EMPTY_CALLED_MODEL");report.emptyState=empty.selectionState;
    const saved = await client.rpc("create_tasting_record", {p_operation_id:randomUUID(),p_record:{enteredName:"합성 위스키 기록",category:"whisky",revisit:"again"}});
    ensure(!saved.error && saved.data?.recordId, "SYNTHETIC_RECORD_FAILED");
    let draft = newTastingDraft(owner, saved.data.recordId, "whisky", "light");
    draft = setAnswer(draft,"nose",{status:"answered",descriptors:["fruit"],intensity:null,freeText:""});
    await tastingRepository(client).save(draft,randomUUID(),saved.data.revision,composeNote(draft),false);
    const selected = await request();
    ensure(selected.selectionState === "generated" && selected.modelUsed && selected.recommendations.length === 3, "ACTUAL_MENU_GENERATION_FAILED");
    ensure(selected.recommendations.some(r=>r.productId==="bunnahabhain-12-463"&&r.score>0),"RESEARCHED_PRODUCT_NOT_RECOMMENDED");
    ensure(selected.recommendations[0].productId && selected.recommendations[0].score>0,"UNSUPPORTED_MENU_PROMOTED");
    ensure(selected.recommendations.some(r=>r.status==="unverified"&&r.productId===null),"UNKNOWN_MENU_LOST");
    const cached = await request();
    ensure(cached.selectionState === "cached" && cached.modelUsed,"CACHE_MISSING");
    ensure(JSON.stringify(cached.recommendations) === JSON.stringify(selected.recommendations), "CACHE_SELECTION_CHANGED");
    report.researchedProduct="bunnahabhain-12-463";
    report.generated={state:selected.selectionState,modelUsed:selected.modelUsed,menuCount:selected.recommendations.length,unknownPreserved:true};
    report.cached={state:cached.selectionState,sameSelection:true};
    const legacy=await request(false);ensure(legacy.method==="evidence-rules-v1"&&!legacy.modelUsed,"LEGACY_REGRESSION");report.legacyCompatible=true;

  } finally {
    if (owner) {
      const removed = await admin.auth.admin.deleteUser(owner);
      if (removed.error) throw Error("SYNTHETIC_CLEANUP_FAILED_JOURNAL_RETAINED");
      await unlink(journal);
      report.syntheticAccountDeleted = true;
    }
    await mkdir("artifacts/verification",{recursive:true});
    await writeFile("artifacts/verification/managed-researched-product.json",JSON.stringify(report,null,2)+"\n");
  }
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error instanceof Error ? error.message : "MENU_SELECTION_VERIFICATION_FAILED");process.exitCode=1;});
