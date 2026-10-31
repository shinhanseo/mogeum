/** Read/compare the reviewed catalog using a disposable account in the approved dev project. No provider calls. */
import {createClient} from "@supabase/supabase-js";
import {readFile,writeFile,unlink,mkdir} from "node:fs/promises";
import {homedir} from "node:os";
import {randomUUID} from "node:crypto";
import {parseCatalogDocument,verifiedCatalogRow,SHARED_CATALOG_VERSION,catalogProduct} from "../supabase/functions/_shared/catalog-contract";
import {productCandidates} from "../supabase/functions/_shared/product-catalog";
import {parseDiscoveryResult} from "../src/features/discovery/contract";
import {validateMenuResult} from "../src/features/menu/result-contract";
async function main(){
 if(process.env.MOGEUM_VERIFY_MANAGED_DEV!=="1")throw Error("EXPLICIT_DEV_OPT_IN_REQUIRED");
 process.loadEnvFile(".env");
 const url="https://vsckzjfgzdpzkzuumldf.supabase.co";
 const config=JSON.parse(await readFile(`${homedir()}/.config/mogeum/credentials/supabase-development.json`,"utf8"));
 if(config.url!==url||process.env.EXPO_PUBLIC_SUPABASE_URL!==url)throw Error("PROJECT_MISMATCH");
 const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(url,config.serviceKey,options),client=createClient(url,key,options);
 const journal=`${homedir()}/.config/mogeum/credentials/catalog-verification-journal.json`;
 if(await readFile(journal,"utf8").catch(e=>{if(e.code==="ENOENT")return null;throw e;}))throw Error("CLEANUP_REQUIRED");
 const reviewed=(JSON.parse(await readFile("supabase/catalog/2026-10-30-reviewed.json","utf8")) as unknown[]).map(parseCatalogDocument);
 const ensure=(ok:unknown,label:string)=>{if(!ok)throw Error(label);};
 let owner:string|undefined;
 const report:Record<string,unknown>={checkedAt:new Date().toISOString(),syntheticOnly:true,humanAccountChanged:false,modelCalled:false};
 try{
  const email=`mogeum-catalog-${randomUUID()}@example.test`,password=randomUUID()+"Aa1!";
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{mogeum_test_fixture:"reviewed-catalog"}});
  ensure(!created.error&&created.data.user,"CREATE_FAILED");owner=created.data.user!.id;
  await writeFile(journal,JSON.stringify({owner}),{mode:0o600});
  const login=await client.auth.signInWithPassword({email,password});ensure(!login.error&&login.data.session,"LOGIN_FAILED");
  const result=await client.from("product_catalog").select("id,family_id,category,status,revision,document").eq("status","verified");
  ensure(!result.error&&result.data,"READ_FAILED");const catalog=result.data!.map(verifiedCatalogRow);
  ensure(catalog.length===37,"CATALOG_COUNT_MISMATCH");
  for(const expected of reviewed)ensure(JSON.stringify(catalog.find(p=>p.id===expected.id))===JSON.stringify(expected),"REVIEWED_DOCUMENT_MISMATCH");
  const call=async(name:string,body:unknown)=>{const r=await fetch(`${url}/functions/v1/${name}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${login.data.session!.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});ensure(r.ok,"ENDPOINT_FAILED");return r.json();};
  const discovery=parseDiscoveryResult(await call("next-drinks",{catalogVersion:SHARED_CATALOG_VERSION,recommendationVersion:"weekly-selection-v1"}));
  ensure(discovery.catalogSize===36&&discovery.generation?.state==="insufficient"&&!discovery.modelUsed,"EMPTY_DISCOVERY_MISMATCH");
  const photoId=randomUUID();
  const photos=[{id:photoId,imageRevision:1,width:1200,height:1800,engine:"apple-vision-v1",lines:reviewed.map((p,i)=>({id:`${photoId}:1:${i}`,text:`${p.name} 30ml 15,000원`,confidence:0.9,polygon:[{x:0.1,y:0.1+i*0.1},{x:0.9,y:0.1+i*0.1},{x:0.9,y:0.15+i*0.1},{x:0.1,y:0.15+i*0.1}]}))}];
  const parsed=await call("menu-recommend",{action:"parse",photos,catalogVersion:SHARED_CATALOG_VERSION});
  ensure(parsed.items.length===4,"PARSED_COUNT_MISMATCH");
  const products=catalog.map(catalogProduct);
  const items=parsed.items.map((item:{name:string;price:number})=>{const candidates=productCandidates(item.name,products);ensure(candidates.length===1&&reviewed.some(p=>p.id===candidates[0].id)&&item.price===15000,"MENU_IDENTITY_MISMATCH");return {...item,confirmed:true,productId:candidates[0].id};});
  const compared=validateMenuResult(await call("menu-recommend",{action:"recommend",photos,items,catalogVersion:SHARED_CATALOG_VERSION,recommendationVersion:"menu-selection-v1"}),items);
  ensure(compared.recommendations.length===4&&compared.recommendations.every(r=>r.status==="unmatched"&&r.score===0)&&!compared.modelUsed,"INVENTED_PREFERENCE");
  report.verified=37;report.categories=catalog.reduce((a,p)=>(a[p.category]=(a[p.category]??0)+1,a),{} as Record<string,number>);
  report.reviewedDocumentsMatched=4;report.menuIdentitiesMatched=4;report.emptyEvidencePreserved=true;
 }finally{
  if(owner){const removed=await admin.auth.admin.deleteUser(owner);if(removed.error)throw Error("CLEANUP_FAILED_JOURNAL_RETAINED");await unlink(journal);report.syntheticAccountDeleted=true;}
  await mkdir("artifacts/verification",{recursive:true});await writeFile("artifacts/verification/managed-catalog37.json",JSON.stringify(report,null,2)+"\n");
 }
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"CATALOG_VERIFICATION_FAILED");process.exitCode=1;});
