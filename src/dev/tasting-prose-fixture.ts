/** Synthetic choices only, shared by isolated native/API QA. Never used by app records. */
import { newTastingDraft, setAnswer } from '../features/tasting/draft';
import { emptyAnswer } from '../features/tasting/answers';
import { questionsFor } from '../features/tasting/questions';
import { changeAroma, emptyAroma } from '../features/tasting/aroma';
import { aromaCatalogs, type TastingCategory } from '../features/tasting/catalog';
export function proseFixture(owner: string, record: string, category: TastingCategory) {
 let draft = newTastingDraft(owner, record, category, 'deep');
 const fields = questionsFor(category, 'deep').flatMap(q=>q.fields);
 const choose = (id: string, label: string) => {
  const option=fields.find(f=>f.id===id)?.options?.find(o=>o.label===label);
  if(option) draft=setAnswer(draft,id,{...emptyAnswer(),status:'answered',descriptors:[option.code],intensity:option.intensity??null});
 };
 choose('conditions.method',category==='whisky'?'스트레이트':category==='beer'?'잔에 따랐어요':'잔으로');
 choose('appearance.type','레드'); choose('appearance.color.red','루비빛'); choose('appearance.color','호박색');
 choose('sweetness.level','중간');choose('palate.sweet','중간');choose('palate.bitter','약함');
 choose('body.weight','가벼워요');choose('body.texture','오일리해요');choose('alcohol.feeling','따뜻해요');choose('finish.length','오래 남아요');choose('finish.length','길어요');
 let aroma=changeAroma(emptyAroma(),{type:'family',code:'fruit'},aromaCatalogs[category]);
 const detail=aromaCatalogs[category].fruit?.includes('apple_pear')?'apple_pear':aromaCatalogs[category].fruit?.[0];
 if(detail)aroma=changeAroma(aroma,{type:'detail',family:'fruit',code:detail},aromaCatalogs[category]);
 draft.modes.deep.aromas.nose=aroma;
 return draft;
}
