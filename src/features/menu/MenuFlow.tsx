import { products as bundledProducts, type Product } from "../../../supabase/functions/_shared/product-catalog";
import { menuRequestQueue } from "./request-queue";
import { menuFailureMessage } from "./result-contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import type { ImagePickerAsset } from "expo-image-picker";
import { MenuScreen, type MenuStep } from "./MenuScreen";
import {
  newMenu,
  persistMenu,
  prepareMenuPhoto,
  prepareMenuPhotoBatch,
  readMenuPhoto,
  restoreMenu,
  type MenuDraft,
  type DevicePhoto,
} from "./device";
import {
  mergeMenuReview,
  activeExclusions,
  excludeMenuItem,
  menuSource,
} from "./review";
import { submitMenu } from "./submission";
import {
  menuRequest, loadMenuCatalog,
  saveMenuSession,
  loadMenuEvidence,
  type MenuResult,
} from "./repository";
import { getSupabase } from "../../lib/supabase";
import { usePhotoPicker } from "../records/usePhotoPicker";
import { PhotoAccessSheet } from "../records/PhotoAccessSheet";
import {
  type MenuPhoto,
  type MenuItem,
} from "../../../supabase/functions/_shared/menu-domain";

type Adapter = {
  restore?: typeof restoreMenu;
  parse: (photos: MenuPhoto[]) => Promise<MenuItem[]>;
  recommend: (photos: MenuPhoto[], items: MenuItem[]) => Promise<MenuResult>;
  save: (d: MenuDraft, photos: MenuPhoto[]) => Promise<number>;
};
export function MenuFlow({
  owner,
  adapter,
  fixtureUri,
  fixtureEvidenceUri,
}: {
  owner: string;
  adapter?: Adapter;
  fixtureUri?: string;
  fixtureEvidenceUri?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<MenuDraft>(newMenu);
  const current = useRef(draft);
  const [step, setStep] = useState<MenuStep>("start");
  const [evidencePhotos, setEvidencePhotos] = useState<Record<string, string>>(
    {},
  );
  const [catalog,setCatalog]=useState<Product[]>(adapter ? bundledProducts : []);
  const [result, setResult] = useState<MenuResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(()=>{
    if(adapter)return;
    let active=true;
    const client=getSupabase();
    if(client)void loadMenuCatalog(client,owner).then(rows=>{if(active)setCatalog(rows);}).catch(()=>{if(active)setError("제품 정보를 불러오지 못했어요. 메뉴 다시 읽기를 눌러 다시 확인해주세요.");});
    return ()=>{active=false;};
  },[owner,adapter]);
  const alive = useRef(true);
  const epoch = useRef(0);
  const lock = useRef(false);
  const replacement = useRef<string | undefined>(undefined);
  const preparing = useRef<number | null>(null);
  const restored = useRef(false);
  const [restoreState, setRestoreState] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const restoreRequest = useRef(0);
  const restoreLoader = useRef(adapter?.restore ?? restoreMenu);
  const writes = useRef(Promise.resolve());
  const latestResult = useRef<MenuResult | null>(null);
  const evidenceRefresh = useRef(0);
  const evidenceFocused = useRef(false);
  const demo = !!adapter;
  const commit = (d: MenuDraft) => {
    d = { ...d, exclusions: activeExclusions(d.exclusions, d.photos) };
    current.current = d;
    if (alive.current) {
      setDraft(d);
      setResult(null);
    }
    if (restored.current) {
      const write = persistMenu(owner, d);
      writes.current = write;
      void write.catch(() => {
        if (alive.current)
          setError(
            "이 기기에 임시 저장하지 못했어요. 앱을 닫기 전에 다시 시도해주세요.",
          );
      });
    }
  };
  const loadDraft = useCallback(async () => {
    if (!alive.current) return;
    const request = ++restoreRequest.current;
    restored.current = false;
    setRestoreState("loading");
    setError("");
    const result = await restoreLoader
      .current(owner)
      .catch(() => ({ status: "failed" as const }));
    if (!alive.current || request !== restoreRequest.current) return;
    if (result.status === "failed") {
      setRestoreState("failed");
      setError(
        "이전 메뉴판을 불러오지 못했어요. 원래 입력은 덮어쓰지 않았어요. 다시 불러오거나 잠시 후 다시 열어주세요.",
      );
      return;
    }
    if (result.status === "ready") {
      current.current = result.draft;
      setDraft(result.draft);
      setStep("photos");
    }
    restored.current = true;
    setRestoreState("ready");
  }, [owner]);
  const stopRestore = useCallback(() => {
    alive.current = false;
    restoreRequest.current++;
    epoch.current++;
  }, []);
  useEffect(() => {
    alive.current = true;
    const generation = ++restoreRequest.current;
    void Promise.resolve().then(() => {
      if (alive.current && restoreRequest.current === generation)
        void loadDraft();
    });
    return stopRestore;
  }, [loadDraft, stopRestore]);
  useEffect(() => {
    latestResult.current = result;
  }, [result]);
  const checkEvidence = useCallback(async () => {
    const previous = latestResult.current;
    if (
      !previous ||
      demo ||
      !evidenceFocused.current ||
      AppState.currentState !== "active"
    )
      return;
    const client = getSupabase();
    if (!client) return;
    const request = ++evidenceRefresh.current;
    const active = () =>
      alive.current &&
      evidenceFocused.current &&
      AppState.currentState === "active" &&
      latestResult.current === previous &&
      request === evidenceRefresh.current;
    try {
      const value = await loadMenuEvidence(client, owner, previous, active);
      if (!active() || value.status === "cancelled") return;
      if (value.status === "stale") {
        setResult(null);
        setEvidencePhotos({});
        setStep("review");
        setError("내 기록이 바뀌었어요. 최신 기록으로 다시 추천받아 주세요.");
      } else setEvidencePhotos(value.photos);
    } catch {
      if (active()) {
        setResult(null);
        setEvidencePhotos({});
        setStep("review");
        setError(
          "최신 취향을 확인하지 못했어요. 연결 후 다시 추천받아 주세요.",
        );
      }
    }
  }, [demo, owner]);
  useFocusEffect(
    useCallback(() => {
      evidenceFocused.current = true;
      void checkEvidence();
      const timer = setInterval(() => void checkEvidence(), 240000);
      return () => {
        clearInterval(timer);
        evidenceFocused.current = false;
        evidenceRefresh.current++;
      };
    }, [checkEvidence]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkEvidence();
    });
    return () => subscription.remove();
  }, [checkEvidence]);
  const valid = (version: number) => alive.current && epoch.current === version;
  function cancel() {
    epoch.current++;
    lock.current = false;
    setBusy(false);
    commit({
      ...current.current,
      photos: current.current.photos.map((p) =>
        p.state === "reading" ? { ...p, state: "waiting" } : p,
      ),
    });
  }
  async function recognize(ids: string[], version: number) {
    for (const id of ids) {
      if (!valid(version)) return;
      const photo = current.current.photos.find((p) => p.id === id);
      if (!photo) continue;
      commit({
        ...current.current,
        photos: current.current.photos.map((p) =>
          p.id === id ? { ...p, state: "reading" } : p,
        ),
      });
      try {
        const read = await readMenuPhoto(photo);
        if (!valid(version)) return;
        commit({
          ...current.current,
          items: current.current.items.filter(
            (item) =>
              item.photoId !== id ||
              item.id.includes(":manual:") ||
              menuSource(item, photo.ocr ? [photo.ocr] : []) ===
                menuSource(item, [read.ocr!]),
          ),
          photos: current.current.photos.map((p) =>
            p.id === id && p.imageRevision === read.imageRevision ? read : p,
          ),
        });
      } catch {
        if (!valid(version)) return;
        commit({
          ...current.current,
          photos: current.current.photos.map((p) =>
            p.id === id ? { ...p, state: "failed", ocr: null } : p,
          ),
        });
        setError(
          "읽지 못한 사진이 있어요. 다른 사진은 유지했어요. 다시 찍거나 읽기를 시도해주세요.",
        );
      }
    }
  }
  async function addAssets(assets: ImagePickerAsset[]) {
    if (lock.current || preparing.current !== null || !restored.current) return;
    const replace = replacement.current;
    replacement.current = undefined;
    const room = replace ? 1 : 5 - current.current.photos.length;
    if (room <= 0) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const version = ++epoch.current;
    preparing.current = version;
    try {
      const selected = assets.slice(0, room);
      const sessionId = current.current.id;
      const old = current.current.photos.find((p) => p.id === replace);
      const next = await prepareMenuPhotoBatch(owner, sessionId, {
        count: selected.length,
        active: () => valid(version),
        prepare: (index) =>
          prepareMenuPhoto(
            owner,
            sessionId,
            selected[index].uri,
            old?.id,
            old ? old.imageRevision + 1 : 1,
          ),
        commit(next) {
          const keep = current.current.photos.filter((p) => p.id !== replace);
          const photos = replace
            ? current.current.photos.map((p) =>
                p.id === replace ? next[0] : p,
              )
            : [...keep, ...next];
          commit({
            ...current.current,
            photos,
            items: current.current.items.filter(
              (i) => !next.some((p) => p.id === i.photoId),
            ),
          });
          setStep("photos");
        },
      });
      if (preparing.current === version) preparing.current = null;
      if (!next || !valid(version)) return;
      await recognize(
        next.map((p) => p.id),
        version,
      );
    } catch {
      if (valid(version))
        setError("사진을 준비하지 못했어요. 다시 골라주세요.");
    } finally {
      if (preparing.current === version) preparing.current = null;
      if (valid(version)) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  const picker = usePhotoPicker((asset) => void addAssets([asset]), {
    limit: Math.max(1, 5 - draft.photos.length),
    onPickMany: (assets) => void addAssets(assets),
  });
  async function retry(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const version = ++epoch.current;
    try {
      await recognize([id], version);
    } finally {
      if (valid(version)) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  function remove(id: string) {
    cancel();
    commit({
      ...current.current,
      photos: current.current.photos.filter((p) => p.id !== id),
      items: current.current.items.filter((i) => i.photoId !== id),
    });
  }
  const backend: Adapter = adapter ?? {
    async parse(photos) {
      const client = getSupabase();
      if (!client) throw new Error("NO_BACKEND");
      const version=epoch.current;
      const value=await menuRequest(client,owner,photos) as {items:MenuItem[];catalog:Product[]};
      if(valid(version))setCatalog(value.catalog);
      return value.items;
    },
    async recommend(photos, items) {
      const client = getSupabase();
      if (!client) throw new Error("NO_BACKEND");
      return (await menuRequest(client, owner, photos, items, {gemini: true})) as MenuResult;
    },
    async save(d, photos) {
      const client = getSupabase();
      if (!client) throw new Error("NO_BACKEND");
      return saveMenuSession(client, owner, d.id, d.revision, photos, d.items);
    },
  };
  async function run(action: "parse" | "recommend") {
    if (lock.current) return;
    const photos = current.current.photos.flatMap((p) =>
      p.ocr ? [p.ocr] : [],
    );
    if (!photos.length) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const version = ++epoch.current;
    try {
      if (action === "parse") {
        const items = await backend.parse(photos);
        if (!valid(version)) return;
        commit({
          ...current.current,
          items: mergeMenuReview(
            items,
            current.current.items,
            photos,
            current.current.exclusions,
          ),
        });
        setStep("review");
      } else {
        const d = await menuRequestQueue.run(owner, () =>
          submitMenu(photos, {
            read: () => current.current,
            write: async (value) => {
              commit(value);
              await writes.current;
            },
            save: backend.save,
            active: () => valid(version),
          }),
        );
        if (!d) return;
        const value = await backend.recommend(photos, d.items);
        if (!valid(version)) return;
        const client = getSupabase();
        let urls: Record<string, string> = {};
        if (adapter)
          urls = Object.fromEntries(
            value.evidenceRecords.map((r) => [r.id, fixtureEvidenceUri ?? ""]),
          );
        else {
          if (!client) throw new Error("NO_BACKEND");
          const evidence = await loadMenuEvidence(client, owner, value, () =>
            valid(version),
          );
          if (evidence.status === "cancelled") return;
          if (evidence.status === "stale")
            throw new Error("MENU_EVIDENCE_STALE");
          urls = evidence.photos;
        }
        if (!valid(version)) return;
        setEvidencePhotos(urls);
        setResult(value);
        setStep("results");
      }
    } catch (error) {
      if (valid(version)) setError(menuFailureMessage(error, action));
    } finally {
      if (valid(version)) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  function manual(photo: DevicePhoto) {
    const item: MenuItem = {
      id: `${photo.id}:${photo.imageRevision}:manual:${randomUUID()}`,
      photoId: photo.id,
      imageRevision: photo.imageRevision,
      lineIds: [],
      name: "",
      price: null,
      serving: null,
      productId: null,
      confirmed: false,
    };
    if (current.current.items.length >= 100) {
      setError("메뉴는 최대 100개까지 확인할 수 있어요.");
      return null;
    }
    commit({
      ...current.current,
      photos: current.current.photos.map((p) =>
        p.id === photo.id && !p.ocr
          ? {
              ...p,
              state: "ready",
              ocr: {
                id: p.id,
                imageRevision: p.imageRevision,
                width: p.width,
                height: p.height,
                engine: "manual",
                lines: [],
              },
            }
          : p,
      ),
      items: [...current.current.items, item],
    });
    setStep("review");
    return item;
  }
  // A result must be discarded when leaving it to edit a photo/menu; refresh taste context on every recommendation.
  function navigate(next: MenuStep) {
    if (lock.current) cancel();
    if (["photos", "review", "start"].includes(next)) setResult(null);
    setStep(next);
  }
  return (
    <>
      <MenuScreen
        catalog={catalog}
        draft={draft}
        restoreState={restoreState}
        onRestoreRetry={() => void loadDraft()}
        step={step}
        result={result}
        evidencePhotos={evidencePhotos}
        busy={busy}
        error={error || picker.error}
        onStep={navigate}
        onAdd={(camera, id) => {
          if (lock.current || preparing.current !== null) return;
          replacement.current = id;
          if (fixtureUri)
            void addAssets([
              { uri: fixtureUri, width: 1200, height: 1600, type: "image" },
            ]);
          else void picker.open(camera);
        }}
        onRemove={remove}
        onRetry={(id) => void retry(id)}
        onCancel={cancel}
        onParse={() => void run("parse")}
        onRecommend={() => {
          commit({
            ...current.current,
            items: current.current.items.map((i) => ({
              ...i,
              confirmed: true,
            })),
          });
          void run("recommend");
        }}
        onDeleteItem={(id) => {
          cancel();
          try {
            commit(excludeMenuItem(current.current, id));
          } catch {
            setError("제외한 메뉴를 보관하지 못했어요. 다시 시도해주세요.");
          }
        }}
        onEdit={(item) =>
          commit({
            ...current.current,
            items: current.current.items.map((i) =>
              i.id === item.id ? item : i,
            ),
          })
        }
        onManual={manual}
        onClose={() => router.back()}
        onEvidence={(recordId) =>
          router.push({ pathname: "/detail", params: { recordId } })
        }
      />
      <PhotoAccessSheet
        purpose="menu"
        access={picker.access}
        onClose={picker.close}
        onContinue={picker.proceed}
        onDismiss={picker.onDismiss}
        busy={picker.busy}
      />
    </>
  );
}
