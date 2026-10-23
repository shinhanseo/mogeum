import type { CellarItem } from "./model";
import type { CellarCursor, CellarFilter, CellarPage } from "./repository";
export type CellarPageState = {
  items: CellarItem[];
  total: number;
  loading: boolean;
  error: boolean;
  hasMore: boolean;
};
export const emptyCellarState = (): CellarPageState => ({
  items: [],
  total: 0,
  loading: false,
  error: false,
  hasMore: false,
});
/** Generation-scoped cursor state: stale completions cannot publish or replace the retry cursor. */
export function createCellarPager(
  page: (
    filter: CellarFilter,
    cursor: CellarCursor | null,
    active: () => boolean,
  ) => Promise<CellarPage>,
  publish: (state: CellarPageState) => void,
  initialTotal = 0,
  refreshPhoto?: (id: string, active: () => boolean) => Promise<string | null>,
) {
  let generation = 0,
    filter: CellarFilter = { query: "", category: "전체" },
    cursor: CellarCursor | null = null,
    state = { ...emptyCellarState(), total: initialTotal };
  const attemptedPhotos = new Set<string>();
  const emit = () => publish({ ...state, items: [...state.items] });
  async function next(retry = false) {
    if (state.loading || !state.hasMore || (state.error && !retry)) return;
    const token = generation;
    state = { ...state, loading: true, error: false };
    emit();
    try {
      const result = await page(filter, cursor, () => token === generation);
      if (token !== generation) return;
      if (
        result.next &&
        cursor &&
        result.next.id === cursor.id &&
        result.next.date === cursor.date
      )
        throw new Error("STALLED_CURSOR");
      const items = new Map(state.items.map((item) => [item.id, item]));
      for (const item of result.items) items.set(item.id, item);
      cursor = result.next;
      state = {
        items: [...items.values()],
        total: result.total ?? state.total,
        loading: false,
        error: false,
        hasMore: cursor !== null,
      };
      emit();
    } catch {
      if (token === generation) {
        state = { ...state, loading: false, error: true };
        emit();
      }
    }
  }
  return {
    async refreshPhoto(id: string, failedUri: string) {
      const current = state.items.find((item) => item.id === id);
      if (
        !refreshPhoto ||
        !current ||
        current.photoUri !== failedUri ||
        attemptedPhotos.has(id)
      )
        return;
      attemptedPhotos.add(id);
      const token = generation;
      try {
        const uri = await refreshPhoto(id, () => token === generation);
        if (token !== generation || !uri) return;
        state = {
          ...state,
          items: state.items.map((item) =>
            item.id === id && item.photoUri === failedUri
              ? { ...item, photoUri: uri }
              : item,
          ),
        };
        emit();
      } catch {
        /* Keep the existing photo fallback and never loop retries. */
      }
    },
    async reset(value: CellarFilter) {
      generation++;
      attemptedPhotos.clear();
      filter = { ...value };
      cursor = null;
      state = { ...emptyCellarState(), total: state.total, hasMore: true };
      return next();
    },
    next: () => next(),
    retry: () => next(true),
    cancel() {
      generation++;
      state = { ...state, loading: false };
    },
  };
}
