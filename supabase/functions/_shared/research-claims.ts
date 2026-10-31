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
/** Normalize age-unit suffixes only; product words and age numbers remain mandatory. */
export function identityMention(text:string,name:string){
 const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/(\d+)[ -]*(?:years?|yo)(?:[ -]*old)?\b/gu,'$1 year').replace(/\bwhisk(?:y|ey)\b/gu,'').replace(/\s+/gu,'');
 return norm(text).includes(norm(name));
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
  if(!identityMention(ref.quote,research.query.name)||(research.query.edition!==null&&!normalize(ref.quote).includes(normalize(research.query.edition))))return invalid();
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
 const originalIdentity=originalStart<0?undefined:research.supports.flatMap((s,i)=>s.sourceIndices.includes(input.identity!.sourceIndex)&&research.text.indexOf(s.text,originalStart)>=0&&identityMention(s.text,research.query.name)&&(research.query.edition===null||normalized(s.text).includes(normalized(research.query.edition)))?[{supportIndex:i,sourceIndex:input.identity!.sourceIndex,quote:s.text}]:[])[0];
 const identityRef=originalIdentity??repair(input.identity);if(!identityRef)return {identity:null,features:[]};
 let identity:ResearchClaims['identity'];
 try{identity=validateResearchClaims({identity:{...input.identity,...identityRef},features:[]},research).identity;}catch{return {identity:null,features:[]};}
 const features:ResearchClaims['features']=[];
 for(const f of input.features){
  const ref=repair(f);if(!ref||features.some(v=>v.factId===f.factId))continue;
  try{features.push(...validateResearchClaims({identity,features:[{...f,...ref}]},research).features);}catch{/* Unsupported claims are omitted individually. */}
 }
 // Supplement only explicit, original producer tasting headings using a closed bilingual vocabulary.
 // This never maps general distillery copy, customer reviews or an unlabelled flavour to an aroma.
 const vocabulary:Record<string,RegExp>={
  '과일 향':/\bfruit(?:y|s)?\b/iu,'꽃 향':/\b(?:floral|flowers?)\b/iu,'꿀·바닐라 향':/\b(?:honey|vanilla)\b/iu,
  '나무 향':/\b(?:oak|wood(?:y)?)\b/iu,'연기 향':/\b(?:smok(?:e|y)|peat(?:y)?)\b/iu,
  '달콤한 맛':/\bsweet(?:ness)?\b/iu,'고소한 맛':/\bnut(?:s|ty|tiness)?\b/iu,'쌉쌀한 맛':/\bbitter(?:ness)?\b/iu,
  '여운 · 오래 남았어요':/\b(?:long|lingering)\b/iu,
 };
 if(originalStart>=0&&identity){
  for(const [supportIndex,support] of research.supports.entries()){
   if(!support.sourceIndices.includes(identity.sourceIndex)||research.text.indexOf(support.text,originalStart)<0)continue;
   const dimension=/^\s*(?:NOSE|AROMA)\b/u.test(support.text)?'향':/^\s*(?:PALATE|TASTE)\b/u.test(support.text)?'맛':/^\s*FINISH\b/u.test(support.text)?'여운':null;
   if(!dimension)continue;
   for(const fact of allowedResearchFeatures(research.query.category)){
    if(fact.dimension!==dimension||features.some(f=>f.factId===fact.id)||!vocabulary[fact.label]?.test(support.text))continue;
    try{features.push(...validateResearchClaims({identity,features:[{factId:fact.id,supportIndex,sourceIndex:identity.sourceIndex,quote:support.text}]},research).features);}catch{/* Negation/comparison checks still apply. */}
   }
  }
 }
 return validateResearchClaims({identity,features},research);
}
