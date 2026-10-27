import { useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Asset } from "expo-asset";
import * as FS from "expo-file-system/legacy";
import { CutoutEditor } from "../../src/features/cutout/CutoutEditor";
import { createCutout } from "../../src/features/cutout/native";
import { Platform, Text, View } from "react-native";
import { colors } from "../../src/theme/tokens";
/** Isolated real-engine probe: bundled illustration/photo fixtures, no login or server writes. */
export default function Preview() {
  const router = useRouter();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const [uri, setUri] = useState("");
  const [status, setStatus] = useState("사진 준비 중");
  const once = useRef(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      const a = Asset.fromModule(
        require("../../assets/fixtures/figma-whisky.jpg"),
      );
      await a.downloadAsync();
      const path = FS.cacheDirectory + "cutout-fixture.jpg";
      await FS.copyAsync({ from: a.localUri ?? a.uri, to: path });
      if (active) setUri(path);
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!__DEV__ || auto !== "1" || !uri || once.current) return;
    once.current = true;
    void (async () => {
      const started = Date.now();
      try {
        const result = await createCutout(uri);
        const directory = FS.documentDirectory + "cutout-probe/";
        await FS.makeDirectoryAsync(directory, { intermediates: true });
        await FS.copyAsync({ from: uri, to: directory + "original.jpg" });
        await FS.copyAsync({ from: result.uri, to: directory + "cutout.png" });
        await FS.writeAsStringAsync(
          directory + "report.json",
          JSON.stringify({
            engine:
              Platform.OS === "ios"
                ? "Apple Vision"
                : "ML Kit Subject Segmentation",
            fixture: "figma-whisky.jpg",
            width: result.width,
            height: result.height,
            durationMs: Date.now() - started,
            success: true,
          }),
        );
        setStatus("처리 완료");
      } catch (e) {
        setStatus("처리 실패");
        await FS.writeAsStringAsync(
          FS.documentDirectory + "cutout-probe-error.json",
          JSON.stringify({
            success: false,
            message: e instanceof Error ? e.message : "failed",
          }),
        );
      }
    })();
  }, [auto, uri]);
  if (!__DEV__) return <Redirect href="/" />;
  if (!uri) return <Text>{status}</Text>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={{ textAlign: "center", color: colors.primary }}>
        개발 검증 · 예시 사진 · 서버 저장 없음 · {status}
      </Text>
      <CutoutEditor
        source={uri}
        onClose={() => router.replace("/")}
        onApply={async () => {
          setStatus("미리보기 선택 완료");
        }}
      />
    </View>
  );
}
