import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { AppState, BackHandler, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/features/auth/AuthProvider";
import { getSupabase } from "../src/lib/supabase";
import { BottomTabBar } from "../src/components/BottomTabBar";
import { WebStatusSpace } from "../src/components/ScreenHeader";
import { DiscoveryReasonScreen } from "../src/features/discovery/DiscoveryReasonScreen";
import { DiscoveryScreen } from "../src/features/discovery/DiscoveryScreen";
import { loadDiscovery } from "../src/features/discovery/repository";
import { wishlistRepository } from "../src/features/discovery/device";
import type { DiscoveryResult } from "../src/features/discovery/contract";
import type { WishlistState } from "../src/features/discovery/wishlist";
import type { Product } from "../supabase/functions/_shared/product-catalog";
import { colors } from "../src/theme/tokens";
export default function DiscoveryRoute() {
  const auth = useAuth();
  if (auth.status === "loading") return <View style={s.page} />;
  if (auth.status !== "signed-in") return <Redirect href="/login" />;
  return (
    <DiscoveryPanel key={auth.session.user.id} owner={auth.session.user.id} />
  );
}
function DiscoveryPanel({ owner }: { owner: string }) {
  const router = useRouter();
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [wishlist, setWishlist] = useState<WishlistState[]>([]);
  const [mode, setMode] = useState<"discover" | "saved">("discover");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const reason = result?.recommendations.find(
    (row) => row.product.id === selectedProduct,
  );
  useFocusEffect(
    useCallback(() => {
      if (!selectedProduct) return;
      const listener = BackHandler.addEventListener("hardwareBackPress", () => {
        setSelectedProduct(null);
        return true;
      });
      return () => listener.remove();
    }, [selectedProduct]),
  );
  const [category, setCategory] = useState<Product["category"] | null>(null);
  const [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0),
    focused = useRef(false),
    saveLock = useRef(false);
  const refresh = useCallback(async () => {
    const sdk = getSupabase();
    if (
      !sdk ||
      saveLock.current ||
      !focused.current ||
      AppState.currentState !== "active"
    )
      return;
    const version = ++generation.current;
    const active = () =>
      focused.current &&
      AppState.currentState === "active" &&
      version === generation.current;
    setSaving(false);
    setBusy(true);
    setError("");
    try {
      await wishlistRepository(sdk).resume(owner);
      const data = await loadDiscovery(sdk, owner);
      if (!active()) return;
      setSelectedProduct((current) =>
        data.recommendations.some((row) => row.product.id === current)
          ? current
          : null,
      );
      setResult(data);
      setWishlist(
        data.wishlist.map((r) => ({
          productId: r.product_id,
          saved: r.saved,
          revision: r.revision,
        })),
      );
    } catch (error) {
      if (active()) {
        // A failed refresh cannot leave old personal comparisons available as current evidence.
        setResult(null);
        setError(
          (error as { code?: string })?.code === "TASTE_CONTEXT_CHANGED"
            ? "내 기록이 바뀌었어요. 최신 기록으로 다시 불러와 주세요."
            : "술을 불러오지 못했어요. 남아 있는 저장 요청도 함께 다시 확인할게요.",
        );
      }
    } finally {
      if (active()) setBusy(false);
    }
  }, [owner]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void refresh();
      return () => {
        focused.current = false;
        generation.current++;
      };
    }, [refresh]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
      else generation.current++;
    });
    return () => subscription.remove();
  }, [refresh]);
  async function toggle(productId: string) {
    const sdk = getSupabase();
    if (
      !sdk ||
      saveLock.current ||
      busy ||
      error ||
      !focused.current ||
      AppState.currentState !== "active"
    )
      return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    const version = generation.current;
    try {
      const previous = wishlist.find((r) => r.productId === productId);
      const resolution = await wishlistRepository(sdk).set(
        owner,
        productId,
        !previous?.saved,
        previous?.revision ?? 0,
      );
      if (
        focused.current &&
        AppState.currentState === "active" &&
        version === generation.current
      ) {
        setWishlist(resolution.state);
        if (resolution.conflicted)
          setError(
            "다른 곳에서 저장 상태가 바뀌었어요. 최신 목록을 확인한 뒤 다시 눌러주세요.",
          );
      }
    } catch {
      if (
        focused.current &&
        AppState.currentState === "active" &&
        version === generation.current
      )
        setError(
          "저장 상태를 확인하지 못했어요. 다시 시도하면 보관한 요청부터 확인해요.",
        );
    } finally {
      saveLock.current = false;
      if (focused.current && AppState.currentState === "active") {
        setSaving(false);
        if (version !== generation.current) void refresh();
      }
    }
  }
  function home(tab: "cellar" | "taste") {
    router.replace({ pathname: "/", params: { tab } });
  }
  return (
    <SafeAreaView
      edges={
        reason ? ["top", "left", "right", "bottom"] : ["top", "left", "right"]
      }
      style={s.page}
    >
      <WebStatusSpace />
      <View style={s.main}>
        {reason && result ? (
          <DiscoveryReasonScreen
            key={reason.product.id}
            row={reason}
            records={result.evidenceRecords}
            saved={wishlist.some(
              (r) => r.productId === reason.product.id && r.saved,
            )}
            busy={busy}
            saving={saving}
            error={error}
            onSave={() => {
              void toggle(reason.product.id);
            }}
            onBack={() => setSelectedProduct(null)}
            onRetry={() => {
              void refresh();
            }}
            onEvidence={(recordId) =>
              router.push({ pathname: "/detail", params: { recordId } })
            }
          />
        ) : null}
        <View style={reason ? s.hidden : s.list}>
          <DiscoveryScreen
            result={result}
            wishlist={wishlist}
            mode={mode}
            category={category}
            onCategory={setCategory}
            onMode={setMode}
            busy={busy}
            saving={saving}
            error={error}
            onSave={(id) => {
              void toggle(id);
            }}
            onRetry={() => {
              void refresh();
            }}
            onBack={() => home("taste")}
            onRecord={(productId) =>
              router.push({ pathname: "/record", params: { productId } })
            }
            onBegin={() =>
              result?.recordCount ? home("cellar") : router.push("/record")
            }
            onReason={setSelectedProduct}
          />
        </View>
      </View>
      {!reason ? (
        <BottomTabBar
          selected="taste"
          onSelect={home}
          onRecord={() => router.push("/record")}
        />
      ) : null}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  hidden: { display: "none" },
  list: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.background },
  main: { flex: 1, width: "100%", maxWidth: 600, alignSelf: "center" },
});
