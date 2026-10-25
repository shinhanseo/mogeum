import { ActivityIndicator } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "../src/features/auth/AuthProvider";
import { AccountScreen } from "../src/features/auth/AccountScreen";
import { logoutAccount } from "../src/features/auth/logout";
import { getSupabase } from "../src/lib/supabase";
import { colors } from "../src/theme/tokens";
export default function AccountRoute() {
  const auth = useAuth(),
    router = useRouter();
  if (auth.status === "loading")
    return <ActivityIndicator color={colors.primary} />;
  if (auth.status !== "signed-in") return <Redirect href="/login" />;
  return (
    <AccountScreen
      key={auth.session.user.id}
      onBack={() => router.back()}
      onLogout={async () => {
        const client = getSupabase();
        if (!client) throw Error("NO_BACKEND");
        await logoutAccount(client, auth.session.user.id);
        router.replace("/login");
      }}
    />
  );
}
