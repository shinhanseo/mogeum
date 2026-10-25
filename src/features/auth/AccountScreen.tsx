import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, space, typography } from "../../theme/tokens";
export function AccountScreen({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onLogout();
    } catch {
      setError("로그아웃하지 못했어요. 연결을 확인하고 다시 시도해주세요.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={s.page}>
      <ScreenHeader
        title="계정"
        onBack={() => {
          if (!busy) onBack();
        }}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.heading}>내 기록은 그대로,</Text>
        <Text style={s.heading}>잠시 쉬어가도 괜찮아요.</Text>
        <View style={s.card}>
          <Text style={s.body}>
            로그아웃해도 술장과 테이스팅 노트는 계정에 보관돼요. 이 기기에 작성
            중인 초안도 지우지 않아요.
          </Text>
          <Text style={s.caption}>
            같은 계정으로 로그인하면 이어서 볼 수 있어요.
          </Text>
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}
        {confirm ? (
          <>
            <Text style={s.body}>이 기기에서 로그아웃할까요?</Text>
            <Button
              label="로그아웃"
              onPress={() => void submit()}
              loading={busy}
            />
            <Button
              label="계속 기록할게요"
              variant="text"
              disabled={busy}
              onPress={() => {
                setConfirm(false);
                setError("");
              }}
            />
          </>
        ) : (
          <Button
            label="로그아웃"
            variant="secondary"
            onPress={() => setConfirm(true)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: space.xl,
    gap: space.md,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  heading: { ...typography.heading, color: colors.text },
  card: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: space.md,
    marginVertical: space.md,
  },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
  error: { ...typography.body, color: colors.primary },
});
