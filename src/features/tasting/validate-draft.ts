import { TASTING_CATALOG_VERSION, aromaCatalogs } from './catalog';
import { validateAnswer, type TastingDraft } from './draft';
import { questionsFor } from './questions';
export function parseTastingDraft(raw:string,owner:string,record:string):TastingDraft {
  if(raw.length>100000)throw new Error('Draft too large');
  const value=JSON.parse(raw) as TastingDraft;
  if(value.schemaVersion!==1||value.catalogVersion!==TASTING_CATALOG_VERSION||value.ownerId!==owner||value.recordId!==record||!['whisky','wine','beer','traditional'].includes(value.category)||!['light','deep'].includes(value.mode)||!Number.isInteger(value.revision)||value.revision<1)throw new Error('Unsupported draft');
  for(const mode of ['light','deep'] as const){
    const saved=value.modes?.[mode];
    if(!saved||!saved.answers||!saved.aromas)throw new Error('Invalid mode draft');
    const questions=questionsFor(value.category,mode);
    if(saved.currentQuestion!==null&&!questions.some(q=>q.id===saved.currentQuestion))throw new Error('Invalid question');
    const fields=questions.flatMap(q=>q.fields);
    for(const [id,answer] of Object.entries(saved.answers)){
      const field=fields.find(f=>f.id===id&&f.kind!=='aroma');
      if(!field)throw new Error('Invalid answer ID');
      validateAnswer(answer);
      if(answer.descriptors.some(code=>!field.options?.some(o=>o.code===code)))throw new Error('Invalid descriptor');
    }
    for(const [id,aroma] of Object.entries(saved.aromas)){
      if(!fields.some(f=>f.id===id&&f.kind==='aroma')||!Array.isArray(aroma.families)||!aroma.details||typeof aroma.freeText!=='string'||aroma.freeText.length>2000||typeof aroma.unknown!=='boolean'||![null,'subtle','moderate','clear','unknown'].includes(aroma.clarity))throw new Error('Invalid aroma');
      const catalog:Readonly<Record<string,readonly string[]>>=aromaCatalogs[value.category];
      if(aroma.families.some(code=>!Object.hasOwn(catalog,code)))throw new Error('Invalid aroma family');
      for(const [family,details] of Object.entries(aroma.details))if(!catalog[family]||!Array.isArray(details)||details.some(code=>!catalog[family].includes(code)))throw new Error('Invalid aroma detail');
    }
  }
  if(value.composition&&(typeof value.composition.text!=='string'||value.composition.text.length>10000||typeof value.composition.edited!=='boolean'||(value.composition.editBuffer!==undefined&&(typeof value.composition.editBuffer!=='string'||value.composition.editBuffer.length>10000))))throw new Error('Invalid composition');
  if(value.pendingSave&&(!/^[0-9a-f-]{36}$/i.test(value.pendingSave.operationId)||!Number.isInteger(value.pendingSave.expectedRevision)||value.pendingSave.expectedRevision<1))throw new Error('Invalid save receipt');
  return value;
}
