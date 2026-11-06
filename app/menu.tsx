import {
  ScreenSkeleton,
} from "../src/components/LoadingSkeleton";

import { Redirect } from "expo-router";
import { useAuth } from "../src/features/auth/AuthProvider";
import { MenuFlow } from "../src/features/menu/MenuFlow";
export default function MenuRoute() {
  const auth = useAuth();
  if (auth.status === "loading") return <ScreenSkeleton kind="menu" />;
  if (auth.status !== "signed-in") return <Redirect href="/login" />;
  return <MenuFlow key={auth.session.user.id} owner={auth.session.user.id} />;
}
