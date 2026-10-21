/** Draft values are retained; only active values may reach notes or AI inputs. */
export type AromaCatalog = Readonly<Record<string, readonly string[]>>;
export type AromaDraft = {
  families: string[];
  details: Record<string, string[]>;
  freeText: string;
  unknown: boolean;
  clarity: 'subtle' | 'moderate' | 'clear' | 'unknown' | null;
};
export type AromaAction =
  | { type: 'family'; code: string }
  | { type: 'detail'; family: string; code: string }
  | { type: 'text'; value: string }
  | { type: 'unknown' }
  | { type: 'clarity'; value: AromaDraft['clarity'] };

export function emptyAroma(): AromaDraft {
  return { families: [], details: {}, freeText: '', unknown: false, clarity: null };
}

function toggle(values: string[], code: string) {
  return values.includes(code) ? values.filter(value => value !== code) : [...values, code];
}

export function changeAroma(draft: AromaDraft, action: AromaAction, catalog: AromaCatalog): AromaDraft {
  switch (action.type) {
    case 'family': {
      if (!Object.hasOwn(catalog, action.code)) throw new Error('Unknown aroma family');
      // Starting a new observation after unknown must not revive hidden selections.
      const families = toggle(draft.unknown ? [] : draft.families, action.code);
      return { ...draft, unknown: false, families };
    }
    case 'detail': {
      if (!draft.families.includes(action.family) || draft.unknown || !catalog[action.family]?.includes(action.code)) throw new Error('Inactive aroma detail');
      return { ...draft, details: { ...draft.details, [action.family]: toggle(draft.details[action.family] ?? [], action.code) } };
    }
    case 'text':
      if (action.value.length > 2000) throw new Error('Aroma text is too long');
      return { ...draft, freeText: action.value, unknown: action.value.trim() ? false : draft.unknown };
    case 'unknown':
      return { ...draft, unknown: !draft.unknown, families: [], freeText: '', details: {} };
    case 'clarity':
      return { ...draft, clarity: action.value };
  }
}

/** Catalog ordering is stable regardless of selection order. No family expands into details. */
export function activeAroma(draft: AromaDraft, catalog: AromaCatalog) {
  if (draft.unknown) return { status: 'unknown' as const, families: [], details: {}, freeText: '', clarity: draft.clarity };
  const families = Object.keys(catalog).filter(code => draft.families.includes(code));
  const details = Object.fromEntries(families.map(code => [code, catalog[code].filter(detail => draft.details[code]?.includes(detail))]));
  const freeText = draft.freeText.trim();
  return { status: families.length || freeText ? 'answered' as const : 'unanswered' as const, families, details, freeText, clarity: draft.clarity };
}
