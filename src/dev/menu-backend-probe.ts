/** Development-only native OCR probe using explicitly supplied synthetic clients. App login is never reused. */
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  prepareMenuPhoto,
  readMenuPhoto,
  persistMenu,
  restoreMenu,
  type MenuDraft,
} from "../features/menu/device";
import {
  validateItems,
  type MenuPhoto,
} from "../../supabase/functions/_shared/menu-domain";
import {
  requireCatalogVersion,
  validateMenuResult,
} from "../features/menu/result-contract";
import { tastingRepository } from "../features/tasting/repository";
import { newTastingDraft, setAnswer } from "../features/tasting/draft";
import { composeNote } from "../features/tasting/answers";
const ensure = (condition: unknown) => {
  if (!condition) throw new Error("MENU_PROBE_EXPECTATION");
};
export async function probeNativeMenu(input: {
  client: SupabaseClient;
  foreign: SupabaseClient;
  owner: string;
  recordId: string;
  revision: number;
  phase: (name: string) => Promise<void>;
  pass: (name: string) => Promise<void>;
}) {
  if (!__DEV__ || Platform.OS === "web") throw new Error("NATIVE_DEV_ONLY");
  const { client, foreign, owner, recordId, revision, phase, pass } = input;
  const sessionId = randomUUID();
  const source = `${FileSystem.cacheDirectory}native-menu-probe-${sessionId}.png`;
  const key = `mogeum:menu:v1:${owner}`;
  const root = `${FileSystem.documentDirectory}menu-drafts/${owner}/${sessionId}/`;
  ensure((await AsyncStorage.getItem(key)) === null);
  const draft: MenuDraft = {
    id: sessionId,
    revision: 0,
    photos: [],
    items: [],
  };
  const invoke = async (sdk: SupabaseClient, body: Record<string, unknown>) => {
    const response = await sdk.functions.invoke("menu-recommend", {
      body,
      timeout: 30000,
    });
    ensure(!response.error);
    requireCatalogVersion(response.data);
    return response.data;
  };
  try {
    await phase("native_two_photo_ocr");
    for (const fixture of ["light", "two-columns"]) {
      await FileSystem.downloadAsync(
        `http://127.0.0.1:8765/${fixture}.png`,
        source,
        {
          sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
        },
      );
      const prepared = await prepareMenuPhoto(owner, sessionId, source);
      const read = await readMenuPhoto(prepared);
      ensure(read.state === "ready" && read.ocr && read.ocr.lines.length > 0);
      draft.photos.push(read);
    }
    const photos = draft.photos.map((p) => p.ocr!) as MenuPhoto[];
    const original = JSON.stringify(photos);
    await pass("native_two_photo_ocr_contract");
    await phase("server_parse_native_ocr");
    const parsed = await invoke(client, { action: "parse", photos });
    draft.items = validateItems(parsed.items, photos);
    ensure(parsed.parser === "geometry-v3" && draft.items.length > 0);
    for (const photo of photos)
      ensure(draft.items.some((item) => item.photoId === photo.id));
    await pass("actual_edge_parse_from_both_photos");
    // Simulate an explicit user correction/product confirmation. Never silently promote OCR into a verified product.
    const index = draft.items.findIndex((item) => /글렌|glen/i.test(item.name));
    ensure(index >= 0);
    draft.items[index] = {
      ...draft.items[index],
      name: "글렌피딕 12년",
      productId: "glenfiddich-12",
      confirmed: true,
    };
    validateItems(draft.items, photos);
    await persistMenu(owner, draft);
    const restored = await restoreMenu(owner);
    ensure(restored.status === "ready");
    if (restored.status !== "ready") throw new Error("RESTORE_FAILED");
    ensure(
      JSON.stringify(restored.draft.items) === JSON.stringify(draft.items),
    );
    ensure(JSON.stringify(photos) === original);
    await pass("native_review_restore_preserves_raw_ocr");
    await phase("server_menu_session_replay_rls");
    const payload = {
      p_id: sessionId,
      p_revision: 0,
      p_photos: photos,
      p_items: draft.items,
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const saved = await client
        .rpc("save_menu_session", payload)
        .abortSignal(AbortSignal.timeout(20000));
      ensure(!saved.error && saved.data === 1);
    }
    const denied = await foreign
      .from("menu_sessions")
      .select("id")
      .eq("id", sessionId);
    ensure(!denied.error && denied.data?.length === 0);
    const foreignWrite = await foreign
      .rpc("save_menu_session", payload)
      .abortSignal(AbortSignal.timeout(20000));
    ensure(foreignWrite.error);
    await pass("native_menu_save_replay_and_foreign_owner_denied");
    await phase("native_note_to_menu_recommendation");
    let note = newTastingDraft(owner, recordId, "whisky", "light");
    note = setAnswer(note, "nose", {
      status: "answered",
      descriptors: ["fruit"],
      intensity: null,
      freeText: "",
    });
    await tastingRepository(client).save(
      note,
      randomUUID(),
      revision,
      composeNote(note),
      false,
    );
    const confirmed = draft.items.filter((item) => item.confirmed);
    const result = validateMenuResult(
      await invoke(client, { action: "recommend", photos, items: confirmed }),
      confirmed,
    );
    const recommended = result.recommendations.find(
      (r) => r.itemId === draft.items[index].id,
    );
    ensure(
      recommended?.status === "similar" &&
        recommended.similar.some((f) => f.recordIds.includes(recordId)),
    );
    const foreignResult = validateMenuResult(
      await invoke(foreign, {
        action: "recommend",
        photos,
        items: confirmed,
      }),
      confirmed,
    );
    ensure(
      foreignResult.evidenceRecords.length === 0 &&
        foreignResult.recommendations.every((r) => r.similar.length === 0),
    );
    await pass("native_saved_note_drives_recommendation_owner_evidence");
    return {
      photos: photos.length,
      engines: photos.map((p) => p.engine),
      lines: photos.map((p) => p.lines.length),
      items: draft.items.length,
      method: result.method,
    };
  } finally {
    await FileSystem.deleteAsync(source, { idempotent: true });
    await FileSystem.deleteAsync(root, { idempotent: true });
    await AsyncStorage.removeItem(key);
  }
}
