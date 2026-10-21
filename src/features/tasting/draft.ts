import type { AromaDraft } from './aroma';
import { activeAroma } from './aroma';
import { aromaCatalogs, type NoteMode, type TastingCategory, TASTING_CATALOG_VERSION } from './catalog';

export type AnswerStatus = 'unanswered' | 'skipped' | 'unknown' | 'none' | 'answered';
export type Answer = {
  status: AnswerStatus;
  descriptors: string[];
  intensity: number | null;
  freeText: string;
};
export type ModeDraft = { answers: Record<string, Answer>; aromas: Record<string, AromaDraft>; currentQuestion: string | null };
export type TastingDraft = {
  schemaVersion: 1;
  catalogVersion: number;
  ownerId: string;
  recordId: string;
  category: TastingCategory;
  mode: NoteMode;
  modes: Record<NoteMode, ModeDraft>;
  revision: number;
};

export function newTastingDraft(ownerId: string, recordId: string, category: TastingCategory, mode: NoteMode): TastingDraft {
  if (!ownerId || !recordId) throw new Error('Saved record and owner required');
  const emptyMode = (): ModeDraft => ({ answers: {}, aromas: {}, currentQuestion: null });
  return { schemaVersion: 1, catalogVersion: TASTING_CATALOG_VERSION, ownerId, recordId, category, mode, modes: { light: emptyMode(), deep: emptyMode() }, revision: 1 };
}

export function validateAnswer(answer: Answer) {
  if (!['unanswered', 'skipped', 'unknown', 'none', 'answered'].includes(answer.status)) throw new Error('Invalid answer state');
  if (answer.intensity !== null && (!Number.isInteger(answer.intensity) || answer.intensity < 0 || answer.intensity > 5)) throw new Error('Invalid intensity');
  if (answer.freeText.length > 2000 || answer.descriptors.length > 100 || answer.descriptors.some(code => !/^[a-z][a-z0-9_.-]{0,79}$/.test(code))) throw new Error('Invalid answer');
  if (answer.status !== 'answered' && (answer.descriptors.length || answer.intensity !== null || answer.freeText)) throw new Error('Non-answer contains observations');
}

export function setAnswer(draft: TastingDraft, questionId: string, answer: Answer): TastingDraft {
  if (!/^[a-z][a-z0-9_.-]{0,79}$/.test(questionId)) throw new Error('Invalid question ID');
  validateAnswer(answer);
  return { ...draft, revision: draft.revision + 1, modes: { ...draft.modes, [draft.mode]: { ...draft.modes[draft.mode], answers: { ...draft.modes[draft.mode].answers, [questionId]: { ...answer, descriptors: [...new Set(answer.descriptors)] } } } } };
}

/** A mode change preserves both drafts and does not fabricate mappings between questions. */
export function switchMode(draft: TastingDraft, mode: NoteMode): TastingDraft {
  return draft.mode === mode ? draft : { ...draft, mode, revision: draft.revision + 1 };
}

/** This is the only projection intended for prose generation or taste analysis. */
export function activeObservations(draft: TastingDraft) {
  const mode = draft.modes[draft.mode];
  const answers = Object.fromEntries(Object.entries(mode.answers).filter(([, value]) => value.status !== 'unanswered' && value.status !== 'skipped'));
  const catalog = draft.category === 'traditional' ? null : aromaCatalogs[draft.category];
  if (!catalog && Object.keys(mode.aromas).length) throw new Error('Traditional aroma catalog is not configured');
  return {
    recordId: draft.recordId, category: draft.category, mode: draft.mode,
    catalogVersion: draft.catalogVersion, revision: draft.revision, answers,
    aromas: Object.fromEntries(Object.entries(mode.aromas).map(([question, value]) => [question, activeAroma(value, catalog!)])),
  };
}
