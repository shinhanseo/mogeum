import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { useAuth } from "../src/features/auth/AuthProvider";
import { colors, space, typography } from "../src/theme/tokens";
export default function SettingsRoute() {
  const router = useRouter(),
    auth = useAuth();
  return (
    <SafeAreaView style={s.page}>
      <ScreenHeader title="설정" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.section}>계정</Text>
        <Pressable
          accessibilityRole="button"
          style={s.row}
          onPress={() =>
            router.push(auth.status === "signed-in" ? "/account" : "/login")
          }
        >
          <View style={s.copy}>
            <Text style={s.title}>
              {auth.status === "signed-in" ? "계정 관리" : "로그인"}
            </Text>
            <Text style={s.caption}>
              {auth.status === "signed-in"
                ? "로그아웃 · 계정 삭제"
                : "내 기록을 안전하게 보관해요"}
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, gap: space.lg },
  section: { ...typography.caption, color: colors.muted, marginTop: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  copy: { flex: 1, gap: space.xs },
  title: { ...typography.nav, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
  body: { ...typography.body, color: colors.text },
  chevron: { ...typography.title, color: colors.muted },
});
