import { Platform } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { registerDevMenuItems } from "expo-dev-client";
import { getBackendState } from "../lib/env";
import { getSupabase } from "../lib/supabase";

/** Explicit operator actions for isolated native QA; never a managed-server login shortcut. */
export async function registerLocalQaMenu() {
  const state = getBackendState();
  if (
    !__DEV__ ||
    Platform.OS === "web" ||
    !state.configured ||
    state.config.url !== "http://127.0.0.1:54321"
  )
    return;
  await registerDevMenuItems([
    {
      name: "로컬 QA · 합성 계정 시작",
      shouldCollapse: true,
      callback: () =>
        router.push({
          pathname: "/dev/local-ui-session",
          params: { runId: `ui-${randomUUID()}` },
        }),
    },
    {
      name: "로컬 QA · 합성 계정 로그아웃",
      shouldCollapse: true,
      callback: () => {
        void getSupabase()
          ?.auth.getUser()
          .then(({ data, error }) => {
            const runId: unknown = data.user?.user_metadata.mogeum_native_probe;
            if (
              !error &&
              typeof runId === "string" &&
              /^[a-z0-9_-]{1,60}$/i.test(runId)
            ) {
              router.push({
                pathname: "/dev/local-ui-session",
                params: { runId, finish: "1" },
              });
            }
          })
          .catch(() => {});
      },
    },
  ]);
}
