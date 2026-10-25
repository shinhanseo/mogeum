import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getSupabase } from "../../lib/supabase";
import { TasteScreen } from "./TasteScreen";
import { createLatestTasteLoader, type TasteLoadState } from "./latest";
import {
  loadTasteContext,
  generateTasteSummary,
  tastePhotoUrls,
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
        async photos(context) {
          const client = getSupabase();
          if (!client || !owner) throw new Error("UNAUTHENTICATED");
          return tastePhotoUrls(
            client,
            owner,
            context.snapshot.records.map((r) => r.id),
          );
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
        setError(
          code === "AI_NOT_CONFIGURED"
            ? "AI 요약을 아직 사용할 수 없어요. 남긴 기록은 그대로 보관돼요."
            : code === "ANALYSIS_TIMEOUT"
              ? "AI 요약이 평소보다 오래 걸리고 있어요. 기록은 보관했어요. 잠시 후 다시 시도해주세요."
              : code === "RATE_LIMITED"
                ? "잠시 쉬었다가 다시 살펴봐요. 오늘 요약 횟수를 모두 썼을 수도 있어요."
                : code === "STALE_INPUT"
                  ? "분석 중 기록이 바뀌었어요. 최신 기록으로 다시 살펴봐요."
                  : "취향 요약을 불러오지 못했어요. 다시 시도해주세요.",
        );
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
