import { useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { useAuth } from "../src/features/auth/AuthProvider";
import { getSupabase } from "../src/lib/supabase";
import { loadRecordDetail } from "../src/features/records/detail";
import { CutoutEditor } from "../src/features/cutout/CutoutEditor";
import { saveLocalCutout } from "../src/features/cutout/storage";
import { Button } from "../src/components/Button";
import { colors } from "../src/theme/tokens";
export default function CutoutRoute() {
  const auth = useAuth();
  const { recordId } = useLocalSearchParams<{ recordId?: string }>();
  if (auth.status === "signed-out") return <Redirect href="/login" />;
  if (auth.status !== "signed-in" || !recordId) return null;
  return (
    <Connected
      key={auth.session.user.id + recordId}
      owner={auth.session.user.id}
      recordId={recordId}
    />
  );
}
function Connected({ owner, recordId }: { owner: string; recordId: string }) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const router = useRouter();
  const [value, setValue] = useState<{ uri: string; path: string } | null>(
    null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const temp = `${FS.cacheDirectory}cutout-source-${Crypto.randomUUID()}.jpg`;
    void (async () => {
      try {
        const client = getSupabase();
        if (!client) throw Error();
        const detail = await loadRecordDetail(client, owner, { recordId });
        const path = detail.record.record_photos
          .filter((p) => p.upload_status === "ready")
          .sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path;
        if (!path || !detail.photoUri) throw Error("NO_PHOTO");
        await FS.downloadAsync(detail.photoUri, temp);
        if (active) setValue({ uri: temp, path });
        else await FS.deleteAsync(temp, { idempotent: true });
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
      void FS.deleteAsync(temp, { idempotent: true }).catch(() => {});
    };
  }, [owner, recordId]);
  const close = () => router.back();
  if (!value)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          padding: 24,
        }}
      >
        {error ? (
          <>
            <Text>사진을 준비하지 못했어요. 원본 기록은 그대로 있어요.</Text>
            <Button label="기록으로 돌아가기" onPress={close} />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  return (
    <CutoutEditor
      source={value.uri}
      onClose={close}
      onApply={async (result) => {
        await saveLocalCutout(owner, value.path, result);
        if (alive.current) close();
      }}
    />
  );
}
