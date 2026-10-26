export type MoveTarget = {
  id: string;
  display_name: string | null;
  category: string | null;
  record_count: number;
};
export type MoveTargetPage = {
  query: string;
  items: MoveTarget[];
  loading: boolean;
  error: boolean;
  hasMore: boolean;
};
export const emptyMoveTargets = (): MoveTargetPage => ({
  query: '', items: [], loading: false, error: false, hasMore: false,
});

/** Every completion belongs to one search generation, including errors and loading. */
export function createMoveTargetPager(
  load: (query: string, from: number) => Promise<MoveTarget[]>,
  publish: (state: MoveTargetPage) => void,
) {
  let generation = 0;
  let offset = 0;
  let state = emptyMoveTargets();
  const emit = () => publish({ ...state, items: [...state.items] });
  async function next() {
    if (state.loading || !state.hasMore || state.error) return;
    const token = generation;
    state = { ...state, loading: true };
    emit();
    try {
      const items = await load(state.query, offset);
      if (token !== generation) return;
      offset += items.length;
      const distinct = new Map(state.items.map(item => [item.id, item]));
      for (const item of items) distinct.set(item.id, item);
      state = { ...state, items: [...distinct.values()], loading: false, hasMore: items.length === 30 };
      emit();
    } catch {
      if (token !== generation) return;
      state = { ...state, loading: false, error: true };
      emit();
    }
  }
  return {
    reset(query: string) {
      generation++;
      offset = 0;
      state = { ...emptyMoveTargets(), query, hasMore: true };
      return next();
    },
    next,
    cancel() {
      generation++;
      state = { ...state, loading: false, hasMore: false };
    },
  };
}
