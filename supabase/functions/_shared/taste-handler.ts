import { analyzeTaste,SUMMARY_VERSION,validateSelection,type TasteSnapshot,type SummaryResult,type TasteAnalysis } from './taste-domain.ts';
export type TasteContext={snapshot:TasteSnapshot;cached:SummaryResult|null;stale:boolean;running:boolean};
export type SummaryPorts={authenticate:(token:string)=>Promise<{id:string}|null>;context:(token:string)=>Promise<TasteContext>;configured:()=>boolean;begin:(owner:string,hash:string,lease:string)=>Promise<string>;finish:(owner:string,hash:string,lease:string,result:SummaryResult|null)=>Promise<boolean>;select:(analysis:TasteAnalysis,signal:AbortSignal)=>Promise<unknown>;model:string};
const headers={'Cache-Control':'no-store','Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
export function tasteHandler(ports:SummaryPorts){return async(request:Request):Promise<Response>=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return response(405,{code:'METHOD_NOT_ALLOWED',retryable:false});
 const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return response(401,{code:'UNAUTHENTICATED',retryable:false});
 let lease:string|null=null;let owner:string|null=null;let hash:string|null=null;
 try{
  const user=await ports.authenticate(token);if(!user)return response(401,{code:'UNAUTHENTICATED',retryable:false});owner=user.id;
  if(Number(request.headers.get('content-length')??0)>1024)return response(413,{code:'INPUT_TOO_LARGE',retryable:false});
  // No owner, source records, model or completed claims may be supplied by the client.
  const reader=request.body?.getReader();let body='';let size=0;const decoder=new TextDecoder();
  if(reader)try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>1024){await reader.cancel();return response(413,{code:'INPUT_TOO_LARGE',retryable:false});}body+=decoder.decode(chunk.value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock();}
  if(body.trim()&&body.trim()!=='{}')return response(400,{code:'INVALID_INPUT',retryable:false});
  const context=await ports.context(token);const analysis=analyzeTaste(context.snapshot);hash=context.snapshot.hash;
  if(context.cached){validateSelection(context.cached.selection,analysis);return response(200,{state:'ready',hash,cached:true});}
  if(!analysis.facts.some(f=>f.positiveIds.length))return response(200,{state:'insufficient',hash});
  if(!ports.configured())return response(503,{code:'AI_NOT_CONFIGURED',retryable:false});
  const candidateLease=crypto.randomUUID();const state=await ports.begin(owner,hash,candidateLease);
  if(state==='cached')return response(200,{state:'ready',hash,cached:true});
  if(state==='running')return response(202,{state:'running',hash,retryAfterSeconds:5});
  if(state==='daily-limit'){
   const now=new Date();const next=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
   return response(429,{code:'SUMMARY_DAILY_LIMIT',retryable:true,retryAfterSeconds:Math.max(1,Math.ceil((next-now.getTime())/1000))});
  }
  if(state==='cooldown')return response(429,{code:'SUMMARY_COOLDOWN',retryable:true,retryAfterSeconds:20});
  if(state==='limited')return response(429,{code:'RATE_LIMITED',retryable:true,retryAfterSeconds:20});
  if(state!=='acquired')return response(409,{code:'STALE_INPUT',retryable:true});
  lease=candidateLease;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),27000);
  let selection;try{selection=validateSelection(await ports.select(analysis,controller.signal),analysis);}finally{clearTimeout(timer);}
  const result:SummaryResult={version:SUMMARY_VERSION,selection,generatedAt:new Date().toISOString(),model:ports.model};
  if(!await ports.finish(owner,hash,lease,result))return response(409,{code:'STALE_INPUT',retryable:true});
  lease=null;return response(200,{state:'ready',hash,cached:false});
 }catch(error){
  if(owner&&hash&&lease)try{await ports.finish(owner,hash,lease,null);}catch{/* Lease expires. Never log personal inputs or provider errors. */}
  if((error as {statusCode?:unknown})?.statusCode===429)return response(429,{code:'AI_PROVIDER_LIMITED',retryable:true,retryAfterSeconds:60});
  return response(502,{code:error instanceof Error && ['TimeoutError','AbortError'].includes(error.name)?'ANALYSIS_TIMEOUT':'ANALYSIS_FAILED',retryable:true});
 }
};}
