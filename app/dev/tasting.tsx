import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { TastingComposer } from '../../src/features/tasting/TastingComposer';
import { newTastingDraft } from '../../src/features/tasting/draft';
import type { NoteMode, TastingCategory } from '../../src/features/tasting/catalog';
import { questionsFor } from '../../src/features/tasting/questions';
/** Isolated native visual QA. No authentication bypass, server request or production entry point. */
export default function TastingPreview(){
  const router=useRouter();const params=useLocalSearchParams<{category:string;mode:string;question:string}>();
  if(!__DEV__)return <Redirect href="/"/>;
  const category=(['whisky','wine','beer','traditional'].includes(params.category)?params.category:'whisky') as TastingCategory;
  const mode=(params.mode==='deep'?'deep':'light') as NoteMode;
  const initial=newTastingDraft('fixture-owner','fixture-record',category,mode);
  if(questionsFor(category,mode).some(q=>q.id===params.question))initial.modes[mode].currentQuestion=params.question;
  return <TastingComposer key={`${category}-${mode}-${params.question}`} initial={initial} onChange={()=>{}} onSave={async()=>{throw new Error('Preview has no server connection');}} onClose={()=>router.replace('/')} previewOnly/>;
}
