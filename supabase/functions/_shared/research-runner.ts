import {validateResearchClaims,type ResearchClaims} from "./research-claims.ts";
import { groundedResearch, researchQuery, type GroundedResearch, type ResearchQuery } from './product-research.ts';
export type ReviewResearch=GroundedResearch & {claims?:ResearchClaims};
export type ResearchState='running'|'backoff'|'busy'|'daily-limit'|'monthly-limit'|'provider-backoff';
export type ResearchPorts={
 version:string;
 begin:(hash:string,lease:string)=>Promise<{state:string;result?:unknown}>;
 finish:(hash:string,lease:string,result:ReviewResearch|null)=>Promise<boolean>;
 research:(query:ResearchQuery,signal:AbortSignal)=>Promise<{research:GroundedResearch}>;
 extract?:(research:GroundedResearch,signal:AbortSignal)=>Promise<ResearchClaims>;
};
/** Revalidate persisted/provider candidates. Nothing here promotes a product to verified. */
export function researchCandidate(value:unknown,query:ResearchQuery):ReviewResearch{
 if(!value||typeof value!=='object')throw new Error('INVALID_RESEARCH_CACHE');
 const v=value as ReviewResearch;
 if(v.status!=='candidate'||JSON.stringify(researchQuery(v.query))!==JSON.stringify(query)||!Array.isArray(v.sources)||!Array.isArray(v.supports))throw new Error('INVALID_RESEARCH_CACHE');
 const max=Math.max(-1,...v.sources.map(s=>s.index));
 if(!Number.isInteger(max)||max>39)throw new Error('INVALID_RESEARCH_CACHE');
 const chunks=Array.from({length:max+1},()=>({} as {web?:{uri:string;title:string}}));
 for(const source of v.sources){if(!Number.isInteger(source.index)||source.index<0||chunks[source.index].web)throw new Error('INVALID_RESEARCH_CACHE');chunks[source.index]={web:{uri:source.url,title:source.title}};}
 const parsed=groundedResearch(query,v.text,{groundingChunks:chunks,groundingSupports:v.supports.map(s=>({segment:{text:s.text},groundingChunkIndices:s.sourceIndices})),webSearchQueries:v.queries,searchEntryPoint:v.searchEntryPointHtml?{renderedContent:v.searchEntryPointHtml}:undefined});
 return v.claims===undefined?parsed:{...parsed,claims:validateResearchClaims(v.claims,parsed)};
}
export async function runProductResearch(input:unknown,ports:ResearchPorts){
 const query=researchQuery(input);
 if(!ports.version.trim()||ports.version.length>200)throw new Error('INVALID_RESEARCH_VERSION');
 const bytes=new TextEncoder().encode(JSON.stringify({version:ports.version,query}));
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const lease=crypto.randomUUID(), job=await ports.begin(hash,lease);
 if(job.state==='cached')return {state:'candidate' as const,cached:true,research:researchCandidate(job.result,query)};
 if(['running','backoff','busy','daily-limit','monthly-limit','provider-backoff'].includes(job.state))return {state:job.state as ResearchState};
 if(job.state!=='acquired')throw new Error('INVALID_RESEARCH_RESERVATION');
 try{
  const signal=AbortSignal.timeout(25000);
  const result=await ports.research(query,signal);
  let candidate=researchCandidate(result.research,query);
  if(ports.extract)candidate={...candidate,claims:validateResearchClaims(await ports.extract(candidate,signal),candidate)};
  if(!await ports.finish(hash,lease,candidate))throw new Error('RESEARCH_LEASE_EXPIRED');
  return {state:'candidate' as const,cached:false,research:candidate};
 }catch(error){try{await ports.finish(hash,lease,null);}catch{/* The lease expires; never log provider output. */}throw error;}
}
