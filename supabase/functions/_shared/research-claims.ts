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
