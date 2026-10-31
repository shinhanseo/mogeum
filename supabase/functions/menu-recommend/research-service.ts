import {MENU_RESEARCH_VERSION,validateMenuResearchBatch,researchedMenuDocument,type MenuResearchBatch,type MenuResearchState} from '../_shared/menu-research.ts';
import type {MenuItem} from '../_shared/menu-domain.ts';
import {reviewResearchSources} from '../_shared/source-review.ts';
import {budgetedProductResearch} from '../product-research/service.ts';
import {identifyMenuResearch,validateMenuIdentities} from './research-identify.ts';
type RpcPort={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export async function researchHash(value:unknown){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');}
const state=(s:string):MenuResearchState=>s==='provider-backoff'||s==='busy'?'backoff':['running','backoff','daily-limit','monthly-limit'].includes(s)?s as MenuResearchState:'unavailable';
/** All new provider work consumes both an authenticated owner lease and the shared research budget. */
export async function researchMenu(database:RpcPort,owner:string,items:MenuItem[],config:{apiKey:string;model:string;transport?:typeof fetch}):Promise<MenuResearchBatch>{
 const unknown=items.filter(i=>i.confirmed&&i.productId===null),targets=unknown.slice(0,2);
 const fallback=(s:MenuResearchState):MenuResearchBatch=>({entries:unknown.map((item,index)=>({itemId:item.id,state:index<2?s:'limit',productId:null})),documents:[]});
 if(!targets.length)return {entries:[],documents:[]};
 if(!config.apiKey||!config.model)return fallback('unavailable');
 const version=`${MENU_RESEARCH_VERSION}:original-v5:bounded:${config.model}`,hash=await researchHash({version,targets:unknown.map(i=>({id:i.id,name:i.name}))}),lease=crypto.randomUUID();
 const call=async(name:string,args:Record<string,unknown>)=>{const r=await database.rpc(name,args);if(r.error)throw Error('MENU_RESEARCH_BUDGET_UNAVAILABLE');return r.data;};
 const job=await call('begin_menu_selection',{p_owner:owner,p_hash:hash,p_version:version,p_lease:lease}) as {state:string;result?:unknown};
 if(job.state==='cached'){
  const cached=job.result as MenuResearchBatch;
  return validateMenuResearchBatch({...cached,entries:[...cached.entries,...unknown.slice(2).map(i=>({itemId:i.id,state:'limit' as const,productId:null}))]},items);
 }
 if(job.state!=='acquired')return fallback(state(job.state));
 const finish=(result:MenuResearchBatch|null)=>call('finish_menu_selection',{p_owner:owner,p_hash:hash,p_version:version,p_lease:lease,p_result:result?{entries:result.entries.slice(0,2),documents:result.documents}:null});
 try{
  const names=targets.map(i=>i.name),identityHash=await researchHash({version:'menu-identify-v1',model:config.model,names}),identityLease=crypto.randomUUID();
  const identityJob=await call('begin_product_research',{p_hash:identityHash,p_lease:identityLease}) as {state:string;result?:{identities:unknown}};
  let identities;
  if(identityJob.state==='cached')identities=validateMenuIdentities(identityJob.result?.identities,names);
  else if(identityJob.state!=='acquired'){await finish(null);return fallback(state(identityJob.state));}
  else{
   try{
    identities=await identifyMenuResearch(names,config);
    if(await call('finish_product_research',{p_hash:identityHash,p_lease:identityLease,p_result:{status:'candidate',identities}})!==true)throw Error('MENU_IDENTIFY_LEASE_EXPIRED');
   }catch(error){await call('finish_product_research',{p_hash:identityHash,p_lease:identityLease,p_result:null}).catch(()=>{});throw error;}
  }
  const documents:MenuResearchBatch['documents']=[];
  const pending=new Map<string,ReturnType<ReturnType<typeof budgetedProductResearch>>>();
  const entries=await Promise.all(unknown.map(async(item,index)=>{
   if(index>=2)return {itemId:item.id,state:'limit' as const,productId:null};
   const identity=identities.find(i=>i.index===index);
   if(!identity)return {itemId:item.id,state:'unresolved' as const,productId:null};
   try{
    const query={name:identity.name,category:identity.category,edition:null},key=JSON.stringify(query);
    if(!pending.has(key))pending.set(key,budgetedProductResearch(database,config)(query));
    const result=await pending.get(key)!;
    if(result.state!=='candidate')return {itemId:item.id,state:state(result.state),productId:null};
    const checks=await reviewResearchSources(result.research,{signal:AbortSignal.timeout(10000)});
    const document=researchedMenuDocument(item,result.research,checks,`menu-research-${(await researchHash({name:item.name,query,itemId:item.id})).slice(0,24)}`);
    if(!document)return {itemId:item.id,state:'unresolved' as const,productId:null};
    documents.push(document);return {itemId:item.id,state:'compared' as const,productId:document.id};
   }catch{return {itemId:item.id,state:'unavailable' as const,productId:null};}
  }));
  const batch=validateMenuResearchBatch({entries,documents},items);
  if(await finish(batch)!==true)throw Error('MENU_RESEARCH_LEASE_EXPIRED');
  return batch;
 }catch(error){
  await finish(null).catch(()=>{});
  if((error as {statusCode?:number})?.statusCode===429)await call('pause_product_research_provider',{p_seconds:900}).catch(()=>{});
  return fallback('unavailable');
 }
}
