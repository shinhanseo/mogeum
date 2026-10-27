import { featureCatalog } from './taste-features.ts';
export const SUMMARY_VERSION='taste-v1';
export type SensoryAnswer={questionId:string;status:string;descriptorCodes:string[]};
export type TasteRecord={id:string;entryId:string;revision:number;category:string|null;name:string|null;date:string;revisit:string|null;rating:number|null;note:{mode:string;version:number;inputRevision:number;confirmedInputRevision:number|null;confirmed:boolean;text?:string|null;answers:SensoryAnswer[]}|null};
export type TasteSnapshot={hash:string;records:TasteRecord[];totalRecords:number;omittedCount:number};
export type TasteFact={id:string;label:string;dimension:string;positiveIds:string[];negativeIds:string[];neutralIds:string[];distinctPositiveDrinks:number};
export type TasteAnalysis={stage:'empty'|'early'|'growing'|'established';recordCount:number;drinkCount:number;positiveCount:number;facts:TasteFact[]};
export type TasteSelection={highlightIds:string[]};
export type SummaryResult={version:typeof SUMMARY_VERSION;selection:TasteSelection;generatedAt:string;model:string};
type Field={id:string;label?:string;kind:string;options?:readonly {code:string;label:string}[];when?:{field:string;includes:string};unless?:{field:string;includes:string}};
const categories=featureCatalog as unknown as Record<string,Record<string,Field[]>>;
const evaluation=(r:TasteRecord)=>r.revisit==='again'?'positive':r.revisit==='not_for_me'?'negative':r.revisit==='okay'?'neutral':r.rating!==null&&r.rating>=4?'positive':r.rating!==null&&r.rating<=2?'negative':'neutral';
export function feature(field:Field,label:string){
 const dimension=field.id==='nose'?'향':field.id.startsWith('palate')||field.id.startsWith('sweetness')||field.id.startsWith('acidity')?'맛':field.id.startsWith('finish')?'여운':field.id.startsWith('body')?'질감':field.id.startsWith('alcohol')?'알코올 자극':field.id.startsWith('tannin')?'떫은 느낌':'탄산';
 const aliases:Record<string,string>={'가벼웠어요':'가벼운 바디','묵직했어요':'묵직한 바디','달콤해요':'달콤한 맛','달콤했어요':'달콤한 맛','상큼해요':'상큼한 맛','상큼했어요':'상큼한 맛','새콤해요':'새콤한 맛','새콤했어요':'새콤한 맛','쌉쌀해요':'쌉쌀한 맛','쌉쌀했어요':'쌉쌀한 맛','고소해요':'고소한 맛','고소했어요':'고소한 맛','깔끔했어요':'깔끔한 여운','과일':'과일 향','꽃':'꽃 향','꿀·바닐라':'꿀·바닐라 향','나무':'나무 향','연기':'연기 향','알코올':'알코올 향','가벼워요':'가벼운 바디','물처럼 가벼워요':'가벼운 바디','묵직해요':'묵직한 바디','매끈해요':'매끈한 질감','크리미해요':'크리미한 질감'};
 const short=dimension==='향'?aliases[label]??(label.endsWith('향')?label:`${label} 향`):dimension==='질감'?aliases[label]??label:aliases[label]??`${field.label||dimension} · ${label}`;
 return {id:`${dimension}:${short}`,label:short,dimension};
}
export function analyzeTaste(snapshot:TasteSnapshot):TasteAnalysis{
 const groups=new Map<string,TasteFact>();const qualified:TasteRecord[]=[];
 for(const record of snapshot.records){
  const note=record.note;const fields=note&&categories[record.category??'']?.[note.mode];
  if(!note||note.version!==2||!note.confirmed||note.inputRevision!==note.confirmedInputRevision||!fields||record.revisit===null&&record.rating===null)continue;
  const answers=new Map(note.answers.map(a=>[a.questionId,a]));const seen=new Set<string>();
  for(const field of fields){
   const a=answers.get(field.id);if(!a||a.status!=='answered')continue;
   if(field.when&&!answers.get(field.when.field)?.descriptorCodes.includes(field.when.includes))continue;
   if(field.unless&&answers.get(field.unless.field)?.descriptorCodes.includes(field.unless.includes))continue;
   for(const code of a.descriptorCodes){const option=field.options?.find(o=>o.code===code);if(!option||['unknown','none'].includes(code))continue;
    const f=feature(field,option.label);if(seen.has(f.id))continue;seen.add(f.id);
    const group=groups.get(f.id)??{...f,positiveIds:[],negativeIds:[],neutralIds:[],distinctPositiveDrinks:0};group[`${evaluation(record)}Ids`].push(record.id);groups.set(f.id,group);
   }
  }
  if(seen.size)qualified.push(record);
 }
 const byId=new Map(qualified.map(r=>[r.id,r]));
 const facts=[...groups.values()].map(f=>({...f,distinctPositiveDrinks:new Set(f.positiveIds.map(id=>byId.get(id)!.entryId)).size})).sort((a,b)=>b.distinctPositiveDrinks-a.distinctPositiveDrinks||b.positiveIds.length-a.positiveIds.length||a.id.localeCompare(b.id));
 const drinkCount=new Set(qualified.map(r=>r.entryId)).size;
 const stage=qualified.length===0?'empty':qualified.length<=2||drinkCount===1?'early':qualified.length<5||drinkCount<3?'growing':'established';
 return {stage,recordCount:qualified.length,drinkCount,positiveCount:qualified.filter(r=>evaluation(r)==='positive').length,facts};
}
export function validateSelection(value:unknown,analysis:TasteAnalysis):TasteSelection{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid summary');const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>k!=='highlightIds')||!Array.isArray(v.highlightIds)||v.highlightIds.length<1||v.highlightIds.length>3||new Set(v.highlightIds).size!==v.highlightIds.length)throw new Error('Invalid highlights');
 const allowed=new Set(analysis.facts.filter(f=>f.positiveIds.length>0).slice(0,60).map(f=>f.id));
 if(v.highlightIds.some(id=>typeof id!=='string'||!allowed.has(id)))throw new Error('Unsupported evidence');
 return {highlightIds:v.highlightIds as string[]};
}
export function selectedFacts(analysis:TasteAnalysis,result:SummaryResult|null){return result?validateSelection(result.selection,analysis).highlightIds.map(id=>analysis.facts.find(f=>f.id===id)!):[];}
export function factSentence(f:TasteFact){const last=f.label.charCodeAt(f.label.length-1);const particle=last>=44032&&last<=55203&&(last-44032)%28===0?'를':'을';return `좋게 남긴 ${f.positiveIds.length}잔에서 ${f.label}${particle} 느꼈어요.${f.negativeIds.length?` 아쉬웠던 ${f.negativeIds.length}잔에도 같은 느낌이 있었어요.`:''}`;}
