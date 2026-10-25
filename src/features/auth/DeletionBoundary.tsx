import { useEffect, useState, useRef, type ReactNode } from "react";
import { AppState, ActivityIndicator, View } from "react-native";
import { usePathname } from "expo-router";
import { useAuth } from "./AuthProvider";
import {
  currentDeletionStatus,
  observeDeletion,
  requestAccountDeletion,
  storedDeletionOwners,
} from "./deletion-device";
import { DeletionScreen } from "./DeletionScreen";
import { signIn } from "./oauth";
import { colors } from "../../theme/tokens";
/** Pending deletion survives Auth removal and app restarts; never show a deleted owner's stale screens. */
export function DeletionBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    path = usePathname();
  const activeOwner = auth.status === "signed-in" ? auth.session.user.id : null;
  const inspectionVersion = useRef(0);
  const [pending, setPending] = useState<string | null>(null),
    [checked, setChecked] = useState(false);
  useEffect(
    () =>
      observeDeletion((owner) => {
        inspectionVersion.current++;
        setPending(owner);
      }),
    [],
  );
  useEffect(() => {
    let alive = true;

    async function inspect() {
      const version = ++inspectionVersion.current;
      try {
        const owners = await storedDeletionOwners();
        let owner = activeOwner
          ? owners.find((o) => o === activeOwner)
          : owners[0];
        // The remote status also recovers an interrupted deletion initiated on another device.
        if (!owner && activeOwner && (await currentDeletionStatus(activeOwner)))
          owner = activeOwner;
        if (alive && version === inspectionVersion.current) {
          setPending(owner ?? null);
          setChecked(true);
        }
      } catch {
        if (alive && version === inspectionVersion.current) setChecked(true);
      }
    }
    if (auth.status !== "loading") void inspect();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void inspect();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, [activeOwner, auth.status]);
  // OAuth callback and explicit fixtures must remain routable while the gate owns the account screens.
  if (path.startsWith("/dev/") || path === "/auth/callback") return children;
  if (!checked)
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
  if (pending && (!activeOwner || activeOwner === pending))
    return (
      <DeletionScreen
        key={pending}
        onRetry={async () => {
          const result = await requestAccountDeletion(pending);
          if (result === "complete") setPending(null);
          return result;
        }}
        onLogin={signIn}
      />
    );
  return children;
}
