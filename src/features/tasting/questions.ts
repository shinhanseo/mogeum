import light from './light.json';
import type { TastingCategory, NoteMode } from './catalog';
import type { Answer, TastingDraft } from './draft';
import { deepQuestions } from './deep';

export type Option = { code: string; label: string; color?: string; intensity?: number };
export type Field = {
  id: string; label: string; kind: 'choice' | 'text' | 'aroma'; max?: number; options?: Option[];
  when?: { field: string; includes: string }; intensity?: boolean;
  unless?: {field:string;includes:string};
};
export type Question = { id: string; figmaId: string; title: string; hint: string; fields: Field[] };
export const lightQuestions = light as Record<TastingCategory, Question[]>;
export function isFieldVisible(field: Field, answers: Record<string, Answer>) {
  if(field.unless && answers[field.unless.field]?.status==='answered'&&answers[field.unless.field]?.descriptors.includes(field.unless.includes))return false;
  return !field.when || (answers[field.when.field]?.status === 'answered' && answers[field.when.field]?.descriptors.includes(field.when.includes));
}
export function questionsFor(category: TastingCategory, mode: NoteMode): Question[] {
  return mode === 'light' ? lightQuestions[category] : deepQuestions[category];
}
export function currentAnswers(draft: TastingDraft) {
  const saved = draft.modes[draft.mode].answers;
  return Object.fromEntries(questionsFor(draft.category, draft.mode).flatMap(q => q.fields.filter(f => isFieldVisible(f, saved)).flatMap(f => saved[f.id] ? [[f.id, saved[f.id]]] : [])));
}
