import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { useAuth } from "../src/features/auth/AuthProvider";
import { getSupabase } from "../src/lib/supabase";
import { loadRecordDetail } from "../src/features/records/detail";
import {
  createLatestDetailLoader,
  type DetailLoadState,
} from "../src/features/records/latest-detail";
import { RecordDetailScreen } from "../src/features/records/RecordDetailScreen";
import { Button } from "../src/components/Button";
import { colors, typography } from "../src/theme/tokens";
export default function Detail() {
  const auth = useAuth();
  const params = useLocalSearchParams<{
    recordId?: string;
    entryId?: string;
  }>();
  if (auth.status === "signed-out") return <Redirect href="/login" />;
  if (auth.status !== "signed-in")
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <ConnectedDetail
      key={JSON.stringify([
        auth.session.user.id,
        params.recordId,
        params.entryId,
      ])}
      owner={auth.session.user.id}
      recordId={params.recordId}
      entryId={params.entryId}
    />
  );
}
function ConnectedDetail({
  owner,
  recordId,
  entryId,
}: {
  owner: string;
  recordId?: string;
  entryId?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<DetailLoadState>({ status: "loading" });
  const focused = useRef(false);
  const loader = useMemo(
    () =>
      createLatestDetailLoader({
        async read() {
          const client = getSupabase();
          if (!client) throw Error("Missing backend");
          return loadRecordDetail(client, owner, { recordId, entryId });
        },
        publish: setState,
      }),
    [owner, recordId, entryId],
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
  const close = () => router.replace("/");
  if (state.status === "ready") {
    const value = state.value;
    return (
      <RecordDetailScreen
        {...value}
        onCutout={() => router.push({pathname:"/cutout",params:{recordId:value.record.id}})}
        onPhotoError={(uri) => {
          if (focused.current && AppState.currentState === "active")
            void loader.refreshPhoto(uri);
        }}
        onEdit={() =>
          router.push({
            pathname: "/edit",
            params: { recordId: value.record.id },
          })
        }
        onRepeat={() =>
          router.push({
            pathname: "/record",
            params: { entryId: value.record.cellar_entry_id },
          })
        }
        onClose={close}
        onNote={() =>
          router.push({
            pathname: "/tasting",
            params: { recordId: value.record.id },
          })
        }
        onSelect={(id) =>
          router.replace({ pathname: "/detail", params: { recordId: id } })
        }
      />
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        padding: 24,
        gap: 16,
      }}
    >
      {state.status === "failed" ? (
        <>
          <Text
            accessibilityRole="alert"
            style={{ ...typography.body, color: colors.text }}
          >
            기록을 불러오지 못했어요. 삭제되었거나 접근할 수 없는 기록일 수
            있어요.
          </Text>
          <Button label="다시 시도" onPress={refresh} />
          <Button
            label="술장으로 돌아가기"
            variant="secondary"
            onPress={close}
          />
        </>
      ) : (
        <ActivityIndicator
          color={colors.primary}
          accessibilityLabel="기록 불러오는 중"
        />
      )}
    </View>
  );
}
