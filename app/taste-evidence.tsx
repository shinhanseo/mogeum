import {
  ScreenSkeleton,
  LoadingSkeleton,
} from "../src/components/LoadingSkeleton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { AppState, Text, View } from "react-native";
import { useAuth } from "../src/features/auth/AuthProvider";
import { getSupabase } from "../src/lib/supabase";
import {
  loadTasteContext,
  tastePhotoUrls,
} from "../src/features/taste/repository";
import {
  createLatestTasteLoader,
  type TasteLoadState,
} from "../src/features/taste/latest";
import { TasteEvidenceScreen } from "../src/features/taste/TasteEvidenceScreen";
import { Button } from "../src/components/Button";
import { colors, typography } from "../src/theme/tokens";
export default function EvidenceRoute() {
  const auth = useAuth();
  if (auth.status === "loading") return <ScreenSkeleton kind="evidence" />;
  if (auth.status !== "signed-in") return <Redirect href="/login" />;
  return (
    <ConnectedEvidence
      key={auth.session.user.id}
      owner={auth.session.user.id}
    />
  );
}
function ConnectedEvidence({ owner }: { owner: string }) {
  const router = useRouter();
  const { factId, category } = useLocalSearchParams<{
    factId?: string;
    category?: string;
  }>();
  const [state, setState] = useState<TasteLoadState>({ status: "loading" });
  const focused = useRef(false);
  const loader = useMemo(
    () =>
      createLatestTasteLoader({
        async context() {
          const client = getSupabase();
          if (!client) throw new Error("NO_BACKEND");
          return loadTasteContext(client);
        },
        async photos(context) {
          const client = getSupabase();
          if (!client) throw new Error("NO_BACKEND");
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
  const refresh = useCallback(() => {
    if (focused.current && AppState.currentState === "active")
      void loader.load();
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      refresh();
      return () => {
        focused.current = false;
        loader.cancel();
      };
    }, [loader, refresh]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
      else loader.cancel();
    });
    return () => subscription.remove();
  }, [loader, refresh]);
  const close = () =>
    router.replace({ pathname: "/", params: { tab: "taste" } });
  if (state.status === "ready")
    return (
      <TasteEvidenceScreen
        key={`${factId ?? "all"}:${category ?? "all"}`}
        initialCategory={category}
        context={state.context}
        photos={state.photos}
        factId={factId}
        onClose={close}
        onOpen={(recordId) =>
          router.push({ pathname: "/detail", params: { recordId } })
        }
      />
    );
  if(state.status !== "failed")return <ScreenSkeleton kind="evidence"/>;
  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        backgroundColor: colors.background,
        justifyContent: "flex-start",
        gap: 16,
      }}
    >
      {state.status === "failed" ? (
        <>
          <Text style={{ ...typography.body, color: colors.text }}>
            최신 기록을 불러오지 못했어요.
          </Text>
          <Button label="다시 시도" onPress={refresh} />
          <Button label="내 취향으로" variant="text" onPress={close} />
        </>
      ) : (
        <LoadingSkeleton kind="evidence" />
      )}
    </View>
  );
}
