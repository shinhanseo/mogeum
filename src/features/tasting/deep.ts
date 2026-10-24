import catalog from './deep.json';
import type { TastingCategory } from './catalog';
import type { Question } from './questions';
export const deepQuestions = catalog as Record<TastingCategory, Question[]>;
