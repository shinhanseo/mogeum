import { activeAroma } from './aroma';
import { aromaCatalogs } from './catalog';
import type { Answer, TastingDraft } from './draft';
import { isFieldVisible, questionsFor, type Field } from './questions';

export const emptyAnswer = (): Answer => ({ status: 'unanswered', descriptors: [], intensity: null, freeText: '' });
/** IMEs can emit spaces/newlines when an untouched multiline input loses focus. */
export function textAnswer(text: string): Answer {
  return text.trim() ? { ...emptyAnswer(), status: 'answered', freeText: text } : emptyAnswer();
}
export function choose(answer: Answer, field: Field, code: string): Answer {
  const option = field.options?.find(o => o.code === code);
  if (!option) throw new Error('Invalid option');
  if (code === 'unknown') return answer.status === 'unknown' ? emptyAnswer() : { ...emptyAnswer(), status: 'unknown' };
  if (code === 'none') return answer.status === 'none' ? emptyAnswer() : { ...emptyAnswer(), status:'none' };
  const selected = answer.descriptors.includes(code);
  const previous = answer.status === 'answered' ? answer.descriptors : [];
  const descriptors = selected ? previous.filter(c => c !== code) : (field.max ?? 1) === 1 ? [code] : [...previous, code];
  if (descriptors.length > (field.max ?? 1)) return answer;
  return { status: descriptors.length || answer.freeText ? 'answered' : 'unanswered', descriptors, intensity: selected ? null : option.intensity ?? null, freeText: answer.status === 'answered' ? answer.freeText : '' };
}
export type StoredAnswer = { questionId: string; status: Answer['status']; descriptorCodes: string[]; intensity: number | null; freeText: string | null };
export function serializeAnswers(draft: TastingDraft): StoredAnswer[] {
  const mode = draft.modes[draft.mode];
  return questionsFor(draft.category, draft.mode).flatMap(q => q.fields.filter(f => isFieldVisible(f, mode.answers) && !(draft.mode==='light'&&f.id==='nose.memo'&&mode.answers.nose?.status==='unknown')).flatMap(f => {
    if (f.kind === 'aroma') {
      const value = mode.aromas[f.id];
      if (!value) return [];
      const aroma = activeAroma(value, aromaCatalogs[draft.category]);
      const result: StoredAnswer[] = [{ questionId: f.id, status: aroma.status, descriptorCodes: aroma.status === 'answered' ? [...aroma.families.map(c => `family.${c}`), ...Object.entries(aroma.details).flatMap(([family, codes]) => codes.map(c => `detail.${family}.${c}`))] : [], intensity: null, freeText: aroma.freeText || null }];
      if (aroma.clarity) result.push({ questionId: `${f.id}.clarity`, status: aroma.clarity === 'unknown' ? 'unknown' : 'answered', descriptorCodes: aroma.clarity === 'unknown' ? [] : [aroma.clarity], intensity: null, freeText: null });
      return result;
    }
    const answer = mode.answers[f.id];
    if (!answer) return [];
    return [{ questionId: f.id, status: answer.status, descriptorCodes: answer.descriptors, intensity: answer.intensity, freeText: answer.freeText || null }];
  }));
}

const aromaLabels: Record<string, string> = {
  fruit:'과일', flower:'꽃', flower_herb:'꽃·허브', grain_malt:'곡물·맥아', sweet:'달콤한 향', wood_spice:'나무·향신료', peat_smoke:'피트·스모크',
  herb_grass:'허브·풀', wood_vanilla:'나무·바닐라', spice:'향신료', earthy:'흙·버섯·가죽', malt_grain:'맥아·곡물', hop:'홉', yeast_ferment:'효모·발효', roast:'로스팅',
  rice_grain:'쌀·곡물', ferment:'누룩·발효', nuts:'견과류', wood:'나무',
  apple_pear:'사과·배', citrus:'감귤', tropical:'열대과일', dried_fruit:'말린 과일', white_flower:'흰 꽃', honey_flower:'꿀꽃', grass:'풀', herb:'허브', barley:'보리', malt:'맥아', bread:'빵', biscuit:'비스킷', vanilla:'바닐라', caramel:'캐러멜', honey:'꿀', chocolate:'초콜릿', oak:'오크', cinnamon:'계피', pepper:'후추', campfire:'모닥불', charcoal:'숯', smoke:'연기', seaweed:'해초', iodine:'요오드', earth:'흙', berry_cherry:'베리·체리', plum:'자두', rose:'장미', violet:'제비꽃', dried_flower:'말린 꽃', mint:'민트', bell_pepper:'피망', toast:'토스트', coconut:'코코넛', clove:'정향', licorice:'감초', mushroom:'버섯', leaves:'낙엽', leather:'가죽', grain:'곡물', pine_resin:'솔·송진', banana:'바나나', floral:'꽃향', dough:'반죽', fermented:'발효 향', coffee:'커피', roasted_grain:'볶은 곡물', burnt:'탄 향', rice:'쌀', steamed_grain:'찐 곡물', other_fruit:'기타 과일',
};
export const aromaLabel = (code: string) => aromaLabels[code] ?? code;
/** Deterministic fallback: only chosen labels and verbatim user text, never expanded tasting claims. */
export function composeNote(draft: TastingDraft): string {
  const answers = serializeAnswers(draft);
  const fields = questionsFor(draft.category, draft.mode).flatMap(q => q.fields.map(f => ({ ...f, questionTitle: q.title.replace(/\n/g, ' ') })));
  return answers.flatMap(answer => {
    if (answer.status === 'skipped' || answer.status === 'unanswered') return [];
    const field = fields.find(f => f.id === answer.questionId);
    if (!field) {
      if(answer.questionId.endsWith('.clarity')){
        const descriptions:Record<string,string>={subtle:'향은 은은하게 느껴졌어요.',moderate:'향의 선명함은 적당했어요.',clear:'향이 선명하게 느껴졌어요.'};
        return answer.status==='unknown'?['향의 선명함은 잘 구분하지 못했어요.']:answer.descriptorCodes.map(c=>descriptions[c]).filter(Boolean);
      }
      return [];
    }
    const label = field.label || field.questionTitle;
    const shortLabels:Record<string,string>={nose:'향',palate:'맛',body:'무게감',alcohol:'알코올 자극',finish:'여운',tannin:'떫은 느낌',carbonation:'탄산',texture:'질감'};
    const descriptionLabel=draft.mode==='light'?(shortLabels[field.id]??label):label.replace(' · 복수 선택', '');
    if (answer.status === 'unknown') return [`${descriptionLabel}: 잘 구분하지 못했어요.`];
    if (answer.status === 'none') return [`${descriptionLabel}: 없었어요.`];
    if (field.kind === 'aroma') {
      const aroma = activeAroma(draft.modes[draft.mode].aromas[field.id], aromaCatalogs[draft.category]);
      const labels = aroma.families.flatMap(f => aroma.details[f]?.length ? aroma.details[f].map(aromaLabel) : [aromaLabel(f)]);
      return [labels.length ? `${labels.join(', ')} 향이 떠올랐어요.` : '', aroma.freeText].filter(Boolean);
    }
    const labels = answer.descriptorCodes.map(c => field.options?.find(o => o.code === c)?.label).filter(Boolean);
    if(draft.mode==='light' && labels.length){
      const values=labels as string[];
      if(field.id==='nose')return [`${values.join(', ')} 향이 떠올랐어요.`];
      if(field.id==='palate'){
        const tastes:Record<string,string>={'달콤해요':'달콤함','상큼해요':'상큼함','새콤해요':'새콤함','쌉쌀해요':'쌉쌀함','고소해요':'고소함','알싸해요':'알싸함','감칠맛이 나요':'감칠맛'};
        return [`${values.map(v=>tastes[v]??v).join(', ')}을 느꼈어요.`];
      }
      return [`${field.id==='alcohol'?'알코올의 자극은 ':field.id==='finish'?'여운은 ':'입안에서는 '}${values.join(', ')}.`];
    }
    return [labels.length ? `${label ? `${label}: ` : ''}${labels.join(', ')}.` : '', answer.freeText ?? ''].filter(Boolean);
  }).join('\n');
}
