import test from 'node:test';
import assert from 'node:assert/strict';
import { composeNote, emptyAnswer } from '../src/features/tasting/answers';
import { newTastingDraft, setAnswer } from '../src/features/tasting/draft';
import { questionsFor } from '../src/features/tasting/questions';
import { observationSentence } from '../src/features/tasting/prose';
test('deep notes in all four categories use sentences while preserving free text and omitting skipped answers',()=>{
 for(const category of ['whisky','wine','beer','traditional'] as const){
  let draft=newTastingDraft('synthetic-owner','synthetic-record',category,'deep');
  const fields=questionsFor(category,'deep').flatMap(q=>q.fields);
  for(const id of ['body.weight','finish.length']){
   const field=fields.find(f=>f.id===id)!;
   draft=setAnswer(draft,id,{...emptyAnswer(),status:'answered',descriptors:[field.options![0].code]});
  }
  const text=composeNote(draft);
  assert.ok(text.includes('입안의 무게감은'));
  assert.ok(text.includes('여운은'));
  assert.ok(!text.includes(':'));
  assert.ok(!text.includes('\n'));
  assert.ok(!text.includes('과일'));
  const memo=fields.find(f=>f.kind==='text')!;
  draft=setAnswer(draft,memo.id,{...emptyAnswer(),status:'answered',freeText:'내 표현 그대로!'});
  assert.ok(composeNote(draft).includes('내 표현 그대로!'));
  draft=setAnswer(draft,'body.weight',{...emptyAnswer(),status:'skipped'});
  assert.ok(!composeNote(draft).includes('입안의 무게감은'));
 }
});
test('conditions and color do not become inferred sensory or preference claims',()=>{
 assert.equal(observationSentence('conditions.decanted','디캔팅 여부',['하지 않았어요']),'디캔팅하지 않고 마셨어요.');
 assert.equal(observationSentence('appearance.color.red','내가 본 색',['루비빛']),'루비빛으로 보였어요.');
 assert.equal(observationSentence('appearance.color','내가 본 색',['호박색']),'호박색으로 보였어요.');
 assert.equal(observationSentence('sweetness.level','단맛',['중간']),'단맛은 중간 정도로 느껴졌어요.');
 assert.equal(observationSentence('alcohol.feeling','느껴지는 자극',['거의 없어요']),'알코올의 느낌은 거의 느껴지지 않았어요.');
});

test('multiple textures and a clean finish stay grammatical without losing selected sensations',()=>{
 assert.equal(observationSentence('body.texture','질감',['매끈해요','오일리해요']),'입안의 질감은 매끈했고 오일리했어요.');
 assert.equal(observationSentence('finish.features','여운',['쓴맛','깔끔하게 사라져요']),'마신 뒤에는 쓴맛 느낌이 남았어요. 여운은 깔끔하게 사라졌어요.');
});
