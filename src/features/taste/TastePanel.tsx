import { tasteSummaryFailureMessage } from "./failure-message";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getSupabase } from "../../lib/supabase";
import { TasteScreen } from "./TasteScreen";
import { createLatestTasteLoader, type TasteLoadState } from "./latest";
import {
  loadTasteContext,
  generateTasteSummary,
  type TasteContext,
} from "./repository";
const browseContext: TasteContext = {
  snapshot: { hash: "", records: [], totalRecords: 0, omittedCount: 0 },
  cached: null,
  stale: false,
  running: false,
};
export function TastePanel({
  owner,
  onRecord,
}: {
  owner: string | null;
  onRecord: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<TasteLoadState>({ status: "loading" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false),
    focused = useRef(false),
    epoch = useRef(0);
  const loader = useMemo(
    () =>
      createLatestTasteLoader({
        async context() {
          const client = getSupabase();
          if (!client || !owner) throw new Error("UNAUTHENTICATED");
          return loadTasteContext(client);
        },
        // This overview now uses illustrations. Evidence/detail fetch photos on demand.
        async photos() {
          return {};
        },
        publish: setState,
      }),
    [owner],
  );
  const refresh = useCallback(async () => {
    if (!owner || !focused.current || AppState.currentState !== "active")
      return;
    await loader.load();
  }, [loader, owner]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setError("");
      setBusy(false);
      void refresh();
      return () => {
        focused.current = false;
        epoch.current++;
        loader.cancel();
      };
    }, [loader, refresh]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        if (focused.current) {
          setBusy(false);
          setError("");
          void refresh();
        }
      } else {
        epoch.current++;
        loader.cancel();
      }
    });
    return () => subscription.remove();
  }, [loader, refresh]);
  const context = owner
    ? state.status === "ready"
      ? state.context
      : null
    : browseContext;
  const photos = owner && state.status === "ready" ? state.photos : {};
  async function generate() {
    if (lock.current || !focused.current || AppState.currentState !== "active")
      return;
    if (!owner) {
      router.push("/login");
      return;
    }
    const client = getSupabase();
    if (!client) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const version = epoch.current;
    const active = () =>
      focused.current &&
      AppState.currentState === "active" &&
      version === epoch.current;
    try {
      const result = await generateTasteSummary(client, owner);
      if (!active()) return;
      if (result.state === "running")
        setError("다른 요청에서 요약 중이에요. 잠시 후 다시 확인해주세요.");
      await refresh();
    } catch (error) {
      if (active()) {
        const code = (error as { code?: string })?.code;
        setError(tasteSummaryFailureMessage(code));
        await refresh();
      }
    } finally {
      lock.current = false;
      if (active()) setBusy(false);
    }
  }
  function addFeeling() {
    const record = context?.snapshot.records.find((r) => !r.note?.confirmed);
    if (record)
      router.push({ pathname: "/detail", params: { recordId: record.id } });
    else onRecord();
  }
  return (
    <TasteScreen
      context={context}
      photos={photos}
      busy={busy}
      error={
        owner && state.status === "failed"
          ? "기록을 불러오지 못했어요. 다시 시도해주세요."
          : error
      }
      onAccount={() => router.push(owner ? "/account" : "/login")}
      onNext={() => router.push(owner ? "/discovery" : "/login")}
      onMenu={() => router.push(owner ? "/menu" : "/login")}
      onGenerate={() => {
        if (context) void generate();
        else {
          setError("");
          void refresh();
        }
      }}
      onEvidence={(factId) =>
        router.push({
          pathname: "/taste-evidence",
          params: factId ? { factId } : {},
        })
      }
      onRecord={addFeeling}
      onOpen={(recordId) =>
        router.push({ pathname: "/detail", params: { recordId } })
      }
    />
  );
}
