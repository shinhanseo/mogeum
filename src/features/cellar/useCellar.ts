import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getSupabase } from "../../lib/supabase";
import { drainPhotoDeletions } from "../records/edit";
import { createCellarRepository, type CellarFilter } from "./repository";
import {
  createCellarPager,
  emptyCellarState,
  type CellarPageState,
} from "./pager";
export function useCellar(owner: string | null, filter: CellarFilter) {
  const [snapshot, setSnapshot] = useState<{
    owner: string;
    state: CellarPageState;
  } | null>(null);
  const knownTotal = useRef<{ owner: string; total: number } | null>(null);
  const pager = useRef<ReturnType<typeof createCellarPager> | null>(null);
  useFocusEffect(
    useCallback(() => {
      const client = getSupabase();
      if (!owner || !client) {
        setSnapshot(null);
        pager.current = null;
        return;
      }
      let active = true;
      const repository = createCellarRepository(client, owner);
      const total =
        knownTotal.current?.owner === owner ? knownTotal.current.total : 0;
      const current = createCellarPager(
        repository.page,
        (state) => {
          if (active) {
            if (!state.loading && !state.error)
              knownTotal.current = { owner, total: state.total };
            setSnapshot({ owner, state });
          }
        },
        total,
        repository.refreshPhoto,
      );
      pager.current = current;
      setSnapshot({
        owner,
        state: { ...emptyCellarState(), total, loading: true },
      });
      void drainPhotoDeletions(client, owner).catch(() => {});
      const timer = setTimeout(
        () => {
          void current.reset({
            query: filter.query,
            category: filter.category,
          });
        },
        filter.query ? 200 : 0,
      );
      return () => {
        active = false;
        clearTimeout(timer);
        current.cancel();
        if (pager.current === current) pager.current = null;
      };
    }, [owner, filter.query, filter.category]),
  );
  const next = useCallback(() => {
    void pager.current?.next();
  }, []);
  const retry = useCallback(() => {
    void pager.current?.retry();
  }, []);
  const refreshPhoto = useCallback((id: string, uri: string) => {
    void pager.current?.refreshPhoto(id, uri);
  }, []);
  const state =
    snapshot?.owner === owner
      ? snapshot.state
      : { ...emptyCellarState(), loading: !!owner };
  return { ...state, next, retry, refreshPhoto };
}
