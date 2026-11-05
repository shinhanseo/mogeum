import { ScreenSkeleton } from "../src/components/LoadingSkeleton";
import { BottomTabBar } from "../src/components/BottomTabBar";
import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";
import { useAuth } from "../src/features/auth/AuthProvider";
import { BartenderScreen } from "../src/features/bartender/BartenderScreen";
import { colors } from "../src/theme/tokens";
export default function BartenderRoute() {
  const auth = useAuth();
  const router = useRouter();
  if (auth.status === "loading")return <ScreenSkeleton kind="chat"/>;
  if (auth.status !== "signed-in") return <Redirect href="/login" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BartenderScreen
        tabMode
        key={auth.session.user.id}
        owner={auth.session.user.id}
      />
      <BottomTabBar
        selected="bartender"
        onSelect={(tab) => router.replace({ pathname: "/", params: { tab } })}
        onRecord={() => router.push("/record")}
      />
    </View>
  );
}
