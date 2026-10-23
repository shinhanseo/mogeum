import { ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/features/auth/AuthProvider";
import { MenuFlow } from "../src/features/menu/MenuFlow";
import { colors } from "../src/theme/tokens";
export default function MenuRoute() {
  const auth = useAuth();
  if (auth.status === "loading")
    return <ActivityIndicator color={colors.primary} />;
  if (auth.status !== "signed-in") return <Redirect href="/login" />;
  return <MenuFlow key={auth.session.user.id} owner={auth.session.user.id} />;
}
