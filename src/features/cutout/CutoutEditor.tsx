import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import * as FS from "expo-file-system/legacy";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { ChoiceChip } from "../../components/ChoiceChip";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, typography } from "../../theme/tokens";
import {
  createCutout,
  cutoutAvailable,
  cutoutError,
  type CutoutImage,
} from "./native";
export function CutoutEditor({
  source,
  onClose,
  onApply,
}: {
  source: string;
  onClose: () => void;
  onApply: (value: CutoutImage | null) => Promise<void>;
}) {
  const [result, setResult] = useState<CutoutImage | null>(null);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const derivative = useRef<string | null>(null);
  const alive = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const uri = derivative.current;
      if (uri) void FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
    };
  }, []);
  async function run() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await createCutout(source);
      if (alive.current) {
        derivative.current = next.uri;
        setResult(next);
        setSelected(true);
      } else await FS.deleteAsync(next.uri, { idempotent: true });
    } catch (error) {
      if (alive.current) setError(cutoutError(error));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function apply() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onApply(selected ? result : null);
    } catch {
      if (alive.current)
        setError("표시 방법을 저장하지 못했어요. 원본 기록은 그대로 있어요.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <SafeAreaView style={s.page}>
      <ScreenHeader title="술장에 놓기" onBack={onClose} onClose={onClose} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>사진 속 한 잔을,{`\n`}내 술장에.</Text>
        <Text style={s.body}>
          원본 사진은 그대로 보관해요. 병과 잔이 겹치면 함께 남거나 일부가 빠질
          수 있어요.
        </Text>
        <View style={s.shelf}>
          <Image
            source={{ uri: selected && result ? result.uri : source }}
            resizeMode="contain"
            style={s.photo}
            accessibilityLabel={
              selected ? "배경을 분리한 술장 미리보기" : "원본 사진 미리보기"
            }
          />
          <View style={s.ledge} />
        </View>
        <View style={s.options}>
          <ChoiceChip
            label="원본 사진"
            selected={!selected}
            onPress={() => setSelected(false)}
            disabled={busy}
          />
          <ChoiceChip
            label="배경 없이"
            selected={selected}
            onPress={() => {
              if (result) setSelected(true);
              else void run();
            }}
            disabled={busy || !cutoutAvailable()}
          />
        </View>
        {!result && (
          <Button
            label="배경 분리해보기"
            variant="secondary"
            onPress={() => void run()}
            loading={busy}
            disabled={!cutoutAvailable()}
          />
        )}
        {!cutoutAvailable() && (
          <Text style={s.body}>
            이 기기에서는 배경 분리를 사용할 수 없어요. 지원되는 개발용 빌드와
            iOS 17 이상 또는 Google Play 서비스가 필요해요.
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={s.body}>
            {error}
          </Text>
        )}
        <Text style={s.caption}>
          이 기기에만 적용되는 술장 표시예요. 캐시가 정리되면 원본으로 보여요.
          결과가 어색하면 원본을 선택해주세요.
        </Text>
      </ScrollView>
      <View style={s.footer}>
        <Button
          label="이 모습으로 놓기"
          loading={busy}
          onPress={() => void apply()}
        />
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 24,
    gap: 18,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  title: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.muted },
  caption: { ...typography.caption, color: colors.muted },
  shelf: {
    height: 300,
    backgroundColor: colors.cabinet.back,
    justifyContent: "flex-end",
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderColor: colors.cabinet.side,
    paddingTop: 20,
  },
  photo: { width: "100%", height: 268 },
  ledge: {
    height: 12,
    backgroundColor: colors.cabinet.front,
    borderTopWidth: 4,
    borderTopColor: colors.cabinet.top,
  },
  options: { flexDirection: "row", gap: 12 },
  footer: { padding: 24 },
});
