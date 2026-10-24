import { emptyAroma } from './aroma';
import type { AnswerStatus, TastingDraft } from './draft';
import type { NoteMode } from './catalog';
import { questionsFor } from './questions';
import { parseTastingDraft } from './validate-draft';
type Row={mode:NoteMode;question_id:string;status:AnswerStatus;descriptor_codes:string[];intensity:number|null;free_text:string|null};
/** Restore by stable IDs/version, never by a question's ordinal position. */
export function restoreAnswers(initial:TastingDraft,rows:Row[]):TastingDraft{
  const draft=JSON.parse(JSON.stringify(initial)) as TastingDraft;
  for(const row of rows){
    if(row.mode!=='light'&&row.mode!=='deep')throw new Error('Unsupported mode');
    const fields=questionsFor(draft.category,row.mode).flatMap(q=>q.fields);
    const field=fields.find(f=>f.id===row.question_id);
    const mode=draft.modes[row.mode];
    if(field?.kind==='aroma'){
      const aroma=mode.aromas[field.id]??emptyAroma();
      aroma.unknown=row.status==='unknown';aroma.skipped=row.status==='skipped';aroma.freeText=row.free_text??'';
      for(const code of row.descriptor_codes){
        if(code.startsWith('family.'))aroma.families.push(code.slice(7));
        else if(code.startsWith('detail.')){const [,family,detail]=code.split('.');(aroma.details[family]??=[]).push(detail);}
        else throw new Error('Unsupported aroma code');
      }
      mode.aromas[field.id]=aroma;
    }else if(row.question_id.endsWith('.clarity')&&fields.some(f=>f.kind==='aroma'&&`${f.id}.clarity`===row.question_id)){
      const id=row.question_id.slice(0,-8);const aroma=mode.aromas[id]??emptyAroma();
      aroma.clarity=row.status==='unknown'?'unknown':row.status==='answered'?row.descriptor_codes[0] as typeof aroma.clarity:null;
      mode.aromas[id]=aroma;
    }else if(field){
      mode.answers[field.id]={status:row.status,descriptors:row.descriptor_codes,intensity:row.intensity,freeText:row.free_text??''};
    }else throw new Error('Unsupported question');
  }
  return parseTastingDraft(JSON.stringify(draft),draft.ownerId,draft.recordId);
}
