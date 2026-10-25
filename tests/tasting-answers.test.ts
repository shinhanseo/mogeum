import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aromaCatalogs } from '../src/features/tasting/catalog';
import { activeAroma, changeAroma, emptyAroma } from '../src/features/tasting/aroma';
import { choose, composeNote, emptyAnswer, serializeAnswers, textAnswer } from '../src/features/tasting/answers';
import { newTastingDraft, setAnswer } from '../src/features/tasting/draft';
import { questionsFor } from '../src/features/tasting/questions';
import { readFileSync } from 'node:fs';
import { parseTastingDraft } from '../src/features/tasting/validate-draft';
import { restoreAnswers } from '../src/features/tasting/restore-answers';

test('all skipped notes produce no prose in all eight category/mode combinations',()=>{
  for(const category of ['whisky','wine','beer','traditional'] as const)for(const mode of ['light','deep'] as const){
    let draft=newTastingDraft('owner','record',category,mode);
    for(const q of questionsFor(category,mode))for(const field of q.fields)if(field.kind!=='aroma')draft=setAnswer(draft,field.id,{...emptyAnswer(),status:'skipped'});
    assert.equal(composeNote(draft),'');
  }
});
test('hidden aroma details never leak into prose and a family does not fabricate specific fruit',()=>{
  const draft=newTastingDraft('owner','record','whisky','deep');
  let aroma=changeAroma(emptyAroma(),{type:'family',code:'fruit'},aromaCatalogs.whisky);
  draft.modes.deep.aromas.nose=aroma;
  assert.equal(composeNote(draft),'과일 향이 떠올랐어요.');
  aroma=changeAroma(aroma,{type:'detail',family:'fruit',code:'apple_pear'},aromaCatalogs.whisky);
  aroma=changeAroma(aroma,{type:'family',code:'fruit'},aromaCatalogs.whisky);
  draft.modes.deep.aromas.nose=aroma;
  assert.equal(composeNote(draft),'');
  assert.deepEqual(serializeAnswers(draft)[0].descriptorCodes,[]);
  assert.equal(activeAroma(aroma,aromaCatalogs.whisky).status,'unanswered');
});
test('wine type switches exclude hidden color and unobserved aroma changes exclude old responses',()=>{
  let draft=newTastingDraft('owner','record','wine','deep');
  const appearance=questionsFor('wine','deep')[1];
  const type=appearance.fields[0];const red=appearance.fields.find(f=>f.id==='appearance.color.red')!;
  draft=setAnswer(draft,type.id,choose(emptyAnswer(),type,type.options![0].code));
  draft=setAnswer(draft,red.id,choose(emptyAnswer(),red,red.options![0].code));
  assert.ok(serializeAnswers(draft).some(a=>a.questionId===red.id));
  draft=setAnswer(draft,type.id,choose(draft.modes.deep.answers[type.id],type,type.options![1].code));
  assert.ok(!serializeAnswers(draft).some(a=>a.questionId===red.id));
  const change=questionsFor('wine','deep')[3];const observed=change.fields[0];const comparison=change.fields[1];
  draft=setAnswer(draft,comparison.id,choose(emptyAnswer(),comparison,comparison.options![1].code));
  draft=setAnswer(draft,observed.id,choose(emptyAnswer(),observed,observed.options!.find(o=>o.label==='확인하지 않았어요')!.code));
  assert.ok(!serializeAnswers(draft).some(a=>a.questionId===comparison.id));
});
test('two-choice limit and unknown are exclusive without carrying old descriptors',()=>{
  const field=questionsFor('whisky','light')[0].fields[0];
  let answer=choose(emptyAnswer(),field,field.options![0].code);
  answer=choose(answer,field,field.options![1].code);
  assert.deepEqual(choose(answer,field,field.options![2].code),answer);
  answer=choose(answer,field,'unknown');
  assert.equal(answer.status,'unknown');assert.deepEqual(answer.descriptors,[]);
  answer=choose(answer,field,field.options![2].code);
  assert.equal(answer.status,'answered');assert.equal(answer.descriptors.length,1);
});
test('server migration embeds the committed versioned catalog exactly',()=>{
  const migration=readFileSync(new URL('../supabase/migrations/20261021100000_tasting_notes.sql',import.meta.url),'utf8');
  const embedded=migration.match(/select '([^']*)'::jsonb;/)![1];
  const snapshot=JSON.parse(readFileSync(new URL('../supabase/tasting-catalog-v2.json',import.meta.url),'utf8'));
  assert.deepEqual(JSON.parse(embedded),snapshot);
});
test('restoration rejects another owner, unsupported versions and corrupt aroma shapes without losing the stored draft',()=>{
  const draft=newTastingDraft('owner','record','whisky','deep');
  draft.modes.deep.aromas.nose=emptyAroma();
  draft.composition={text:'Original',edited:true,sourceRevision:1,editBuffer:'Still editing'};
  const raw=JSON.stringify(draft);
  assert.deepEqual(parseTastingDraft(raw,'owner','record'),draft);
  assert.throws(()=>parseTastingDraft(raw,'other','record'));
  assert.throws(()=>parseTastingDraft(JSON.stringify({...draft,catalogVersion:1}),'owner','record'));
  const broken=structuredClone(draft);broken.modes.deep.aromas.nose.families='fruit' as unknown as string[];
  assert.throws(()=>parseTastingDraft(JSON.stringify(broken),'owner','record'));
  assert.equal(JSON.parse(raw).composition.editBuffer,'Still editing');
});
test('saved v2 answers restore by stable question ID, including skipped aromas and independent clarity',()=>{
  const draft=newTastingDraft('owner','record','whisky','deep');
  const restored=restoreAnswers(draft,[
    {mode:'deep',question_id:'nose.clarity',status:'answered',descriptor_codes:['clear'],intensity:null,free_text:null},
    {mode:'deep',question_id:'nose',status:'answered',descriptor_codes:['family.fruit','detail.fruit.apple_pear'],intensity:null,free_text:null},
  ]);
  assert.match(composeNote(restored),/사과·배/);assert.match(composeNote(restored),/선명하게/);
  const skipped=restoreAnswers(draft,[{mode:'deep',question_id:'nose',status:'skipped',descriptor_codes:[],intensity:null,free_text:null}]);
  assert.equal(serializeAnswers(skipped)[0].status,'skipped');assert.equal(composeNote(skipped),'');
  assert.deepEqual(draft.modes.deep.aromas,{});
});

test('blank IME input stays unanswered through validation, draft restore and note serialization',()=>{
  for(const category of ['whisky','wine','beer','traditional'] as const)for(const mode of ['light','deep'] as const){
    for(const field of questionsFor(category,mode).flatMap(q=>q.fields).filter(f=>f.kind==='text')){
      for(const text of ['', ' ', '\n', ' \n\t', '\u3000']){
        const draft=setAnswer(newTastingDraft('owner','record',category,mode),field.id,textAnswer(text));
        assert.deepEqual(draft.modes[mode].answers[field.id],emptyAnswer());
        assert.doesNotThrow(()=>parseTastingDraft(JSON.stringify(draft),'owner','record'));
        assert.equal(composeNote(draft),'');
        assert.ok(serializeAnswers(draft).every(a=>a.freeText===null));
      }
      const text='  내가 느낀 향\n부드러운 느낌  ';
      const written=setAnswer(newTastingDraft('owner','record',category,mode),field.id,textAnswer(text));
      assert.equal(written.modes[mode].answers[field.id].freeText,text);
      const cleared=setAnswer(written,field.id,textAnswer(' \n'));
      assert.equal(composeNote(cleared),'');
      assert.equal(written.modes[mode].answers[field.id].freeText,text);
    }
  }
});
