import {parseCatalogDocument,type CatalogDocument} from './catalog-contract.ts';
import type {MenuItem} from './menu-domain.ts';
import {allowedResearchFeatures} from './research-claims.ts';
import {researchCandidate,type ReviewResearch} from './research-runner.ts';
import {producerOrigins,type SourceCheck} from './source-review.ts';
export const MENU_RESEARCH_VERSION='menu-research-v1';
export type MenuResearchState='compared'|'unresolved'|'limit'|'unavailable'|'running'|'backoff'|'daily-limit'|'monthly-limit';
export type MenuResearchEntry={itemId:string;state:MenuResearchState;productId:string|null};
export type MenuResearchBatch={entries:MenuResearchEntry[];documents:CatalogDocument[]};
/** Session-only source-backed candidate, never a verified shared-catalog insert. */
export function researchedMenuDocument(item:MenuItem,input:ReviewResearch,checks:SourceCheck[],id:string):CatalogDocument|null{
 const r=researchCandidate(input,input.query),identity=r.claims?.identity;
 if(item.productId!==null||!item.confirmed||!identity)return null;
 const check=checks.find(c=>c.sourceIndex===identity.sourceIndex&&c.state==='quote-matched'&&c.identityMatched&&c.finalUrl);
 if(!check||!producerOrigins.includes(new URL(check.finalUrl!).origin))return null;
 const allowed=allowedResearchFeatures(r.query.category);
 const features=(r.claims?.features??[]).filter(f=>f.sourceIndex===identity.sourceIndex&&check.matchedFactIds.includes(f.factId)).slice(0,3).flatMap(f=>{
  const fact=allowed.find(v=>v.id===f.factId);return fact?[{...fact,evidence:f.quote.slice(0,600)}]:[];
 });
 if(!features.length)return null;
 return parseCatalogDocument({id,familyId:id,name:r.query.name,category:r.query.category,edition:r.query.edition??'검색으로 찾은 제품 후보',aliases:[...new Set([item.name,r.query.name])],baseAliases:[],features,source:{url:check.finalUrl,title:r.sources.find(s=>s.index===identity.sourceIndex)?.title??r.query.name,checkedAt:check.checkedAt.slice(0,10),kind:'producer'},description:'제조사 원문의 특징을 내 기록과 비교했어요. 메뉴판의 제품·연산·빈티지와 같은지 확인해 주세요.'});
}
export function validateMenuResearchBatch(value:unknown,items:MenuItem[]):MenuResearchBatch{
 const v=value as MenuResearchBatch;
 if(!v||!Array.isArray(v.entries)||v.entries.length>100||!Array.isArray(v.documents)||v.documents.length>2)throw Error('INVALID_MENU_RESEARCH');
 const documents=v.documents.map(parseCatalogDocument),seen=new Set<string>(),used=new Set<string>();
 if(new Set(documents.map(d=>d.id)).size!==documents.length)throw Error('INVALID_MENU_RESEARCH');
 for(const entry of v.entries){
  const item=items.find(i=>i.id===entry.itemId&&i.confirmed&&i.productId===null);
  if(!item||seen.has(item.id)||!['compared','unresolved','limit','unavailable','running','backoff','daily-limit','monthly-limit'].includes(entry.state))throw Error('INVALID_MENU_RESEARCH');
  seen.add(item.id);
  if(entry.state==='compared'){
   const document=documents.find(d=>d.id===entry.productId);
   if(!document||!document.id.startsWith('menu-research-')||!document.aliases.includes(item.name)||!document.features.length||document.source.kind!=='producer'||!producerOrigins.includes(new URL(document.source.url).origin)||used.has(document.id))throw Error('INVALID_MENU_RESEARCH');
   const allowed=allowedResearchFeatures(document.category);
   if(document.features.some(f=>!allowed.some(a=>a.id===f.id&&a.label===f.label&&a.dimension===f.dimension)))throw Error('INVALID_MENU_RESEARCH');
   used.add(document.id);
  }else if(entry.productId!==null)throw Error('INVALID_MENU_RESEARCH');
 }
 if(used.size!==documents.length||seen.size!==items.filter(i=>i.confirmed&&i.productId===null).length)throw Error('INVALID_MENU_RESEARCH');
 return {entries:v.entries.map(e=>({...e})),documents};
}
