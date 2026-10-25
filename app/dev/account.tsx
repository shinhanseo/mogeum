import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { AccountScreen } from "../../src/features/auth/AccountScreen";
export default function DevAccount() {
  const router = useRouter();
  const { failure } = useLocalSearchParams<{ failure?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <SafeAreaView edges={["top"]} style={{flex:1}}><Text>개발 검증 · 세션 변경 없음 · 로그아웃 UI fixture</Text><AccountScreen
      onBack={() => router.back()}
      onLogout={async () => {
        if (failure === "1") throw Error("EXPLICIT_FIXTURE_FAILURE");
        router.back();
      }}
    /></SafeAreaView>
  );
}
