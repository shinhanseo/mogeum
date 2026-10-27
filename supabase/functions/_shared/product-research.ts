import { publicSourceUrl } from './catalog-contract.ts';
export type ResearchQuery={name:string;category:'whisky'|'wine'|'beer'|'traditional';edition:string|null};
export type GroundedResearch={status:'candidate';query:ResearchQuery;text:string;sources:{index:number;url:string;title:string}[];supports:{text:string;sourceIndices:number[]}[];queries:string[];searchEntryPointHtml:string|null};
const fail=():never=>{throw new Error('INVALID_PRODUCT_RESEARCH');};
const object=(v:unknown):Record<string,unknown>=>!v||typeof v!=='object'||Array.isArray(v)?fail():v as Record<string,unknown>;
export function researchQuery(value:unknown):ResearchQuery{
 const v=object(value);
 if(Object.keys(v).some(k=>!['name','category','edition'].includes(k))||typeof v.name!=='string'||!v.name.trim()||v.name.length>200||/[\x00-\x1f]/.test(v.name)||!['whisky','wine','beer','traditional'].includes(v.category as string)||!(v.edition===null||(typeof v.edition==='string'&&v.edition.trim()&&v.edition.length<=100)))return fail();
 return {name:v.name.trim(),category:v.category as ResearchQuery['category'],edition:v.edition as string|null};
}
/** Citation presence is not product identity or factual verification. Results remain candidates. */
export function groundedResearch(query:ResearchQuery,text:unknown,metadata:unknown):GroundedResearch{
 if(typeof text!=='string'||!text.trim()||text.length>24000) return fail();
 const m=object(metadata);
 if(!Array.isArray(m.groundingChunks)||m.groundingChunks.length>40||!Array.isArray(m.groundingSupports)||m.groundingSupports.length>100||!Array.isArray(m.webSearchQueries)||!m.webSearchQueries.length||m.webSearchQueries.length>20)return fail();
 const queries=m.webSearchQueries.map(q=>{if(typeof q!=='string'||!q.trim()||q.length>1000)return fail();return q;});
 const sources=m.groundingChunks.flatMap((raw,index)=>{
  const chunk=object(raw);if(!chunk.web)return [];
  const web=object(chunk.web);
  try{const url=publicSourceUrl(web.uri);return [{index,url,title:typeof web.title==='string'?web.title.slice(0,500):''}];}catch{return [];}
 });
 const sourceIds=new Set(sources.map(s=>s.index));
 const supports=m.groundingSupports.flatMap(raw=>{
  const row=object(raw),segment=object(row.segment);
  if(typeof segment.text!=='string'||!segment.text.trim()||segment.text.length>4000||!text.includes(segment.text)||!Array.isArray(row.groundingChunkIndices)||row.groundingChunkIndices.length>40)return [];
  const indices=[...new Set(row.groundingChunkIndices.filter((i):i is number=>Number.isInteger(i)&&sourceIds.has(i as number)))];
  return indices.length?[{text:segment.text,sourceIndices:indices}]:[];
 });
 if(!sources.length||!supports.length)throw new Error('PRODUCT_RESEARCH_UNGROUNDED');
 const entry=m.searchEntryPoint?object(m.searchEntryPoint).renderedContent:null;
 // Kept as provider metadata for later compliant attribution; never render untrusted HTML in native UI.
 const searchEntryPointHtml=typeof entry==='string'&&entry.length<=32000?entry:null;
 return {status:'candidate',query:researchQuery(query),text,sources,supports,queries,searchEntryPointHtml};
}
