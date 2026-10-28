import { publicSourceUrl } from './catalog-contract.ts';
import { products } from './product-catalog.ts';
import { researchCandidate, type ReviewResearch } from './research-runner.ts';
export type SourceCheck={sourceIndex:number;url:string;finalUrl:string|null;state:'quote-matched'|'unapproved-source'|'unavailable'|'unsupported-content'|'quote-not-found';identityMatched:boolean;matchedFactIds:string[];checkedAt:string};
// Explicitly reviewed seed producer origins only. Provider output never expands this registry.
export const producerOrigins = [...new Set(products.filter(p=>p.source.kind==='producer').map(p=>new URL(p.source.url).origin))];
const normalized=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();
function pageText(html:string){
 return html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_m,n:string)=>{const number=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return number>0&&number<=0x10ffff?String.fromCodePoint(number):' ';})
  .replace(/&(amp|nbsp|quot|apos|lt|gt);/gi,(_m,n:string)=>({amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>'}[n.toLowerCase()]??' '));
}
async function boundedText(response:Response){
 if(Number(response.headers.get('content-length')??0)>512000){await response.body?.cancel();throw Error('SOURCE_TOO_LARGE');}
 const reader=response.body?.getReader();if(!reader)return '';
 let bytes=0,text='';const decoder=new TextDecoder();
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>512000){await reader.cancel();throw Error('SOURCE_TOO_LARGE');}text+=decoder.decode(chunk.value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
/** An exact source-quote match is review evidence, never an automatic factual approval. */
export async function reviewResearchSources(input:ReviewResearch,config:{signal:AbortSignal;fetcher?:typeof fetch;origins?:readonly string[]}){
 const research=researchCandidate(input,input.query),allowed=new Set(config.origins??producerOrigins);
 const identity=research.claims?.identity;
 if(!identity)return [];
 const source=research.sources.find(s=>s.index===identity.sourceIndex);
 if(!source)return [];
 const base:SourceCheck={sourceIndex:source.index,url:source.url,finalUrl:null,state:'unavailable',identityMatched:false,matchedFactIds:[],checkedAt:new Date().toISOString()};
 const signal=AbortSignal.any([config.signal,AbortSignal.timeout(8000)]);
 let url=source.url;
 try{
  for(let redirects=0;redirects<=2;redirects++){
   publicSourceUrl(url);
   if(!allowed.has(new URL(url).origin))return [{...base,state:'unapproved-source' as const}];
   const response=await (config.fetcher??fetch)(url,{redirect:'manual',signal,headers:{Accept:'text/html,text/plain','User-Agent':'Mogeum-ProductReview/1.0'}});
   if([301,302,303,307,308].includes(response.status)){
    const target=response.headers.get('location');await response.body?.cancel();
    if(!target||redirects===2)return [base];
    url=new URL(target,url).href;continue;
   }
   if(!response.ok){await response.body?.cancel();return [base];}
   const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
   if(!['text/html','text/plain'].includes(type??'')){await response.body?.cancel();return [{...base,finalUrl:url,state:'unsupported-content' as const}];}
   const raw=await boundedText(response),text=normalized(type==='text/html'?pageText(raw):raw);
   const identityMatched=text.includes(normalized(identity.quote));
   const matchedFactIds=identityMatched?(research.claims?.features??[]).filter(f=>text.includes(normalized(f.quote))).map(f=>f.factId):[];
   const all=identityMatched&&matchedFactIds.length>0&&matchedFactIds.length===research.claims!.features.length;
   return [{...base,finalUrl:url,state:all?'quote-matched' as const:'quote-not-found' as const,identityMatched,matchedFactIds}];
  }
 }catch{/* No request content, provider errors or private data in logs. */}
 return [base];
}
