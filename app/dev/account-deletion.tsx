import { useLocalSearchParams, Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native";
import { DeletionScreen } from "../../src/features/auth/DeletionScreen";
export default function DeletionFixture() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <Text>개발 검증 · 실제 계정 삭제 없음</Text>
      <DeletionScreen
        onRetry={async () => {
          if (state === "failure") throw Error("EXPLICIT_FIXTURE_FAILURE");
          if (state === "login") throw Error("LOGIN_REQUIRED");
          return "running";
        }}
      />
    </SafeAreaView>
  );
}
