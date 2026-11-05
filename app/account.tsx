import {
  ScreenSkeleton,
} from "../src/components/LoadingSkeleton";
import { requestAccountDeletion } from "../src/features/auth/deletion-device";

import { Redirect, useRouter } from "expo-router";
import { useAuth } from "../src/features/auth/AuthProvider";
import { AccountScreen } from "../src/features/auth/AccountScreen";
import { logoutAccount } from "../src/features/auth/logout";
import { getSupabase } from "../src/lib/supabase";
export default function AccountRoute() {
  const auth = useAuth(),
    router = useRouter();
  if (auth.status === "loading") return <ScreenSkeleton kind="settings" />;
  if (auth.status !== "signed-in") return <Redirect href="/login" />;
  return (
    <AccountScreen
      key={auth.session.user.id}
      onBack={() => router.back()}
      onDelete={() => requestAccountDeletion(auth.session.user.id)}
      onLogout={async () => {
        const client = getSupabase();
        if (!client) throw Error("NO_BACKEND");
        await logoutAccount(client, auth.session.user.id);
        router.replace("/login");
      }}
    />
  );
}
