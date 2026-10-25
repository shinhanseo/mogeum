import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, space, typography } from "../../theme/tokens";
export function AccountScreen({
  onBack,
  onLogout,
  onDelete,
}: {
  onBack: () => void;
  onLogout: () => Promise<void>;
  onDelete?: () => Promise<unknown>;
}) {
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const lock = useRef(false);
  async function remove() {
    if (lock.current || !onDelete) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onDelete();
    } catch {
      setError("삭제 요청을 보내지 못했어요. 다시 시도해주세요.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
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
        {deleting ? (
          <>
            <Text style={s.heading}>술장을 떠나기 전에</Text>
            <View style={s.card}>
              <Text style={s.body}>
                모든 술 사진, 기록, 테이스팅 노트와 취향 분석이 삭제돼요. 이
                기기에 보관한 계정 초안도 정리해요.
              </Text>
              <Text style={s.body}>
                삭제 요청을 보내면 되돌릴 수 없어요. 사진과 기록을 정리하는 데
                시간이 걸릴 수 있어요.
              </Text>
              <Text style={s.caption}>
                Apple·카카오 계정 자체가 삭제되지는 않아요.
              </Text>
            </View>
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <Button
              label="기록과 계정 영구 삭제"
              loading={busy}
              onPress={() => void remove()}
            />
            <Button
              label="내 술장 유지하기"
              variant="text"
              disabled={busy}
              onPress={() => {
                setDeleting(false);
                setError("");
              }}
            />
          </>
        ) : (
          <>
            <Text style={s.heading}>내 기록은 그대로,</Text>
            <Text style={s.heading}>잠시 쉬어가도 괜찮아요.</Text>
            <View style={s.card}>
              <Text style={s.body}>
                로그아웃해도 술장과 테이스팅 노트는 계정에 보관돼요. 이 기기에
                작성 중인 초안도 지우지 않아요.
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
            {!!onDelete && !confirm && (
              <Button
                label="계정 삭제"
                variant="text"
                disabled={busy}
                onPress={() => {
                  setDeleting(true);
                  setError("");
                }}
              />
            )}
          </>
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
