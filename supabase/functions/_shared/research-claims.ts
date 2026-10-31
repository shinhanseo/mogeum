import {featureCatalog} from './taste-features.ts';
import {feature} from './taste-domain.ts';
import type {GroundedResearch, ResearchQuery} from './product-research.ts';
export type ClaimReference={supportIndex:number;sourceIndex:number;quote:string};
export type ResearchClaims={identity:({name:string;edition:string|null}&ClaimReference)|null;features:({factId:string}&ClaimReference)[]};
export function allowedResearchFeatures(category:ResearchQuery['category']){
 const fields=featureCatalog[category].light;
 const facts=fields.flatMap(field=>field.options.filter(o=>!['unknown','none'].includes(o.code)).map(o=>feature(field,o.label)));
 return [...new Map(facts.map(f=>[f.id,f])).values()];
}
const invalid=():never=>{throw new Error('INVALID_RESEARCH_CLAIMS');};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:invalid();
const exact=(v:Record<string,unknown>,keys:string[])=>{if(Object.keys(v).some(k=>!keys.includes(k)))invalid();};
function reference(raw:Record<string,unknown>,research:GroundedResearch):ClaimReference{
 const {supportIndex,sourceIndex,quote}=raw;
 if(!Number.isInteger(supportIndex)||!Number.isInteger(sourceIndex)||typeof quote!=='string'||!quote.trim()||quote.length>2000) return invalid();
 const support=research.supports[supportIndex as number];
 if(!support||!support.sourceIndices.includes(sourceIndex as number)||!support.text.includes(quote))return invalid();
 return {supportIndex:supportIndex as number,sourceIndex:sourceIndex as number,quote};
}
/** Checks provenance and ontology only. A model citation still requires factual/edition review. */
export function validateResearchClaims(input:unknown,research:GroundedResearch):ResearchClaims{
 const v=object(input);exact(v,['identity','features']);
 let identity:ResearchClaims['identity']=null;
 if(v.identity!==null){
  const i=object(v.identity);exact(i,['name','edition','supportIndex','sourceIndex','quote']);
  if(i.name!==research.query.name||i.edition!==research.query.edition)return invalid();
  const ref=reference(i,research), normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  if(!normalize(ref.quote).includes(normalize(research.query.name))||(research.query.edition!==null&&!normalize(ref.quote).includes(normalize(research.query.edition))))return invalid();
  identity={name:research.query.name,edition:research.query.edition,...ref};
 }
 if(!Array.isArray(v.features)||v.features.length>20)return invalid();
 const allowed=new Set(allowedResearchFeatures(research.query.category).map(f=>f.id));
 const features=v.features.map(raw=>{const f=object(raw);exact(f,['factId','supportIndex','sourceIndex','quote']);
  if(typeof f.factId!=='string'||!allowed.has(f.factId))return invalid();
  const ref=reference(f,research);
  if(!identity||ref.sourceIndex!==identity.sourceIndex)return invalid();
  const segment=research.supports[ref.supportIndex].text;
  // Conservative hold: never remove a negation/comparison by selecting only a positive-looking substring.
  if(/\b(?:no|not|without|unlike|less|more|than|compared|might|may)\b|없|않|아니|비교|보다/iu.test(segment))return invalid();
  return {factId:f.factId,...ref};
 });
 if(new Set(features.map(f=>f.factId)).size!==features.length)return invalid();
 return {identity,features};
}

/** Repair provider citation indices only when the quoted content uniquely identifies a support.
 * Returned quotes are original support text, never newly generated sensory evidence. */
export function extractSupportedClaims(input:ResearchClaims,research:GroundedResearch):ResearchClaims{
 const normalized=(s:string)=>s.normalize('NFKC').replace(/\*\*/g,'').replace(/\s+/g,' ').trim();
 const repair=(ref:ClaimReference)=>{
  const quote=normalized(ref.quote);
  if(!quote)return null;
  const matches=research.supports.flatMap((s,i)=>s.sourceIndices.includes(ref.sourceIndex)&&normalized(s.text).includes(quote)?[{supportIndex:i,sourceIndex:ref.sourceIndex,quote:s.text}]:[]);
  return matches.length===1?matches[0]:null;
 };
 if(!input.identity)return {identity:null,features:[]};
 const originalStart=research.text.indexOf('Original producer excerpt:');
 const originalIdentity=originalStart<0?undefined:research.supports.flatMap((s,i)=>s.sourceIndices.includes(input.identity!.sourceIndex)&&research.text.indexOf(s.text,originalStart)>=0&&normalized(s.text).includes(normalized(research.query.name))&&(research.query.edition===null||normalized(s.text).includes(normalized(research.query.edition)))?[{supportIndex:i,sourceIndex:input.identity!.sourceIndex,quote:s.text}]:[])[0];
 const identityRef=originalIdentity??repair(input.identity);if(!identityRef)return {identity:null,features:[]};
 let identity:ResearchClaims['identity'];
 try{identity=validateResearchClaims({identity:{...input.identity,...identityRef},features:[]},research).identity;}catch{return {identity:null,features:[]};}
 const features:ResearchClaims['features']=[];
 for(const f of input.features){
  const ref=repair(f);if(!ref||features.some(v=>v.factId===f.factId))continue;
  try{features.push(...validateResearchClaims({identity,features:[{...f,...ref}]},research).features);}catch{/* Unsupported claims are omitted individually. */}
 }
 return validateResearchClaims({identity,features},research);
}
