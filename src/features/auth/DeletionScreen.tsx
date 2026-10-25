import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, space, typography } from "../../theme/tokens";
export function DeletionScreen({
  onRetry,
  onLogin,
  initialTask,
}: {
  onRetry: () => Promise<"running" | "complete">;
  initialTask?: Promise<"running" | "complete">;
  onLogin?: (provider: "apple" | "kakao") => Promise<void>;
}) {
  const [state, setState] = useState<
    "ready" | "busy" | "running" | "error" | "login" | "complete"
  >(initialTask ? "busy" : "ready");
  const lock = useRef(false);
  useEffect(() => {
    if (!initialTask) return;
    let alive = true;
    lock.current = true;
    void initialTask
      .then(
        (result) => {
          if (alive) setState(result);
        },
        (error) => {
          if (alive)
            setState(
              error instanceof Error &&
                ["LOGIN_REQUIRED", "PROVIDER_LOGIN_REQUIRED"].includes(
                  error.message,
                )
                ? "login"
                : "error",
            );
        },
      )
      .finally(() => {
        if (alive) lock.current = false;
      });
    return () => {
      alive = false;
    };
  }, [initialTask]);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setState("busy");
    try {
      setState(await onRetry());
    } catch (error) {
      setState(
        error instanceof Error &&
          ["LOGIN_REQUIRED", "PROVIDER_LOGIN_REQUIRED"].includes(error.message)
          ? "login"
          : "error",
      );
    } finally {
      lock.current = false;
    }
  }
  async function login(provider: "apple" | "kakao") {
    if (lock.current || !onLogin) return;
    lock.current = true;
    setState("busy");
    try {
      await onLogin(provider);
      setState("ready");
    } catch {
      setState("login");
    } finally {
      lock.current = false;
    }
  }
  return (
    <SafeAreaView style={s.page}>
      <ScreenHeader title="계정 삭제" />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>
          {state === "complete"
            ? "계정이 삭제됐어요."
            : "마지막까지\n안전하게 정리할게요."}
        </Text>
        <View style={s.card}>
          <Text style={s.body}>
            삭제 요청이 보관됐어요. 사진과 기록을 정리한 뒤 계정을 삭제해요.
            정리가 끝날 때까지 새 기록은 남길 수 없어요.
          </Text>
          <Text style={s.caption}>
            앱을 닫았더라도 다시 열어 이어서 정리할 수 있어요.
          </Text>
        </View>
        {state === "error" ? (
          <Text accessibilityRole="alert" style={s.body}>
            정리를 끝내지 못했어요. 연결을 확인하고 다시 시도해주세요. 완료된
            단계는 반복하지 않아요.
          </Text>
        ) : null}
        {state === "running" ? (
          <Text accessibilityRole="alert" style={s.body}>
            아직 정리 중인 항목이 있어요. 잠시 후 이어서 정리해주세요.
          </Text>
        ) : null}
        {state === "login" ? (
          <>
            <Text accessibilityRole="alert" style={s.body}>
              로그인 연결 해제를 확인해야 해요. 삭제를 요청한 같은 계정으로
              로그인한 뒤 이어서 정리해주세요.
            </Text>
            <Button
              label="Apple로 다시 로그인"
              variant="apple"
              onPress={() => void login("apple")}
            />
            <Button
              label="카카오로 다시 로그인"
              variant="kakao"
              onPress={() => void login("kakao")}
            />
          </>
        ) : null}
        {state !== "complete" && state !== "login" ? (
          <Button
            label={state === "ready" ? "이어서 정리하기" : "다시 정리하기"}
            loading={state === "busy"}
            onPress={() => void submit()}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: space.xl,
    gap: space.lg,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  title: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
});
