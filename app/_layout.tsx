import { DeletionBoundary } from "../src/features/auth/DeletionBoundary";
import { AuthProvider } from "../src/features/auth/AuthProvider";
import { useEffect } from "react";
import { attachAuthLifecycle } from "../src/lib/supabase";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_700Bold,
} from "@expo-google-fonts/noto-sans-kr";
import { ActivityIndicator, Text, View } from "react-native";
import { colors } from "../src/theme/tokens";

export default function RootLayout() {
  useEffect(attachAuthLifecycle, []);
  useEffect(() => {
    if (__DEV__) {
      void import("../src/dev/local-qa-menu")
        .then(({ registerLocalQaMenu }) => registerLocalQaMenu())
        .catch(() => {});
    }
  }, []);
  const [loaded, error] = useFonts({
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator
          color={colors.primary}
          accessibilityLabel="모금 준비 중"
        />
      </View>
    );
  if (error)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: colors.background,
        }}
      >
        <Text>글꼴을 불러오지 못했어요. 앱을 다시 열어주세요.</Text>
      </View>
    );
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <DeletionBoundary>
          <Stack screenOptions={{ headerShown: false }} />
        </DeletionBoundary>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
