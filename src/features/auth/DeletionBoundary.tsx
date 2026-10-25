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
  // Keep the navigator mounted so OAuth callbacks and completion redirects remain routable.
  const bypass = path.startsWith("/dev/") || path === "/auth/callback";
  const owner =
    pending && (!activeOwner || activeOwner === pending) ? pending : null;
  const gated = !bypass && (!checked || !!owner);
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1, opacity: gated ? 0 : 1 }}
        pointerEvents={gated ? "none" : "auto"}
        accessibilityElementsHidden={gated}
        importantForAccessibility={gated ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {gated && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
          }}
        >
          {!checked ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : owner ? (
            <DeletionScreen
              key={owner}
              onRetry={async () => {
                const result = await requestAccountDeletion(owner);
                if (result === "complete") setPending(null);
                return result;
              }}
              onLogin={signIn}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
