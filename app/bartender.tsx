import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/features/auth/AuthProvider";
import { BartenderScreen } from "../src/features/bartender/BartenderScreen";
import { colors } from "../src/theme/tokens";
export default function BartenderRoute() {
  const auth = useAuth();
  if (auth.status === "loading")
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (auth.status !== "signed-in") return <Redirect href="/login" />;
  return (
    <BartenderScreen key={auth.session.user.id} owner={auth.session.user.id} />
  );
}
