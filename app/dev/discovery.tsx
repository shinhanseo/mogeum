import { useState } from "react";
import { Platform, Text } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { DiscoveryReasonScreen } from "../../src/features/discovery/DiscoveryReasonScreen";
import { DiscoveryScreen } from "../../src/features/discovery/DiscoveryScreen";
import { BottomTabBar } from "../../src/components/BottomTabBar";
import { discoverDrinks } from "../../supabase/functions/_shared/next-drinks-domain";
import {
  products,
  PRODUCT_CATALOG_VERSION,
  type Product,
} from "../../supabase/functions/_shared/product-catalog";
import type { DiscoveryResult } from "../../src/features/discovery/contract";
import type { WishlistState } from "../../src/features/discovery/wishlist";
import { colors, typography } from "../../src/theme/tokens";
const preview: DiscoveryResult = {
  catalog: products,
  recommendations: discoverDrinks(
    {
      hash: "synthetic-preview",
      records: [],
      totalRecords: 0,
      omittedCount: 0,
    },
    [],
  ),
  wishlist: [],
  evidenceRecords: [],
  tasteHash: "synthetic-preview",
  recordCount: 0,
  sensoryRecordCount: 0,
  omittedSensoryRecords: 0,
  method: "evidence-rules-v1",
  modelUsed: false,
  catalogVersion: PRODUCT_CATALOG_VERSION,
  catalogSize: products.length,
  limitedCatalog: true,
};
const syntheticRecords = ["positive-a", "positive-b", "negative-a"].map(
  (id, index) => ({
    id,
    entryId: id,
    revision: 1,
    category: "whisky",
    name: `합성 위스키 ${index + 1}`,
    date: "2026-10-24",
    revisit: index === 2 ? "not_for_me" : "again",
    rating: null,
    note: {
      mode: "light",
      version: 2,
      inputRevision: 1,
      confirmedInputRevision: 1,
      confirmed: true,
      answers: [
        { questionId: "nose", status: "answered", descriptorCodes: ["fruit"] },
      ],
    },
  }),
);
const mixedPreview: DiscoveryResult = {
  ...preview,
  recommendations: discoverDrinks(
    {
      hash: "synthetic-mixed",
      records: syntheticRecords,
      totalRecords: 3,
      omittedCount: 0,
    },
    [],
  ),
  evidenceRecords: syntheticRecords.map((r) => ({
    id: r.id,
    name: r.name,
    category: "whisky",
    date: r.date,
    revision: r.revision,
    revisit: r.revisit as "again" | "not_for_me",
    noteText: null,
  })),
  recordCount: 3,
  sensoryRecordCount: 3,
  tasteHash: "synthetic-mixed",
};
export default function DiscoveryPreview() {
  const { scenario, productId } = useLocalSearchParams<{
    scenario?: string;
    productId?: string;
  }>();
  const data = scenario === "mixed" ? mixedPreview : preview;
  const [selectedProduct, setSelectedProduct] = useState<string | null>(
    productId ?? null,
  );
  const reason = data.recommendations.find(
    (r) => r.product.id === selectedProduct,
  );
  const [mode, setMode] = useState<"discover" | "saved">("discover");
  const [category, setCategory] = useState<Product["category"] | null>(null);
  const [wishlist, setWishlist] = useState<WishlistState[]>(
    ["glenlivet-12", "cloudy-bay-sb-2024", "boksoondoga-son"].map(
      (productId) => ({ productId, saved: true, revision: 1 }),
    ),
  );
  const [notice, setNotice] = useState("개발 시안 · 서버 저장 없음");
  if (!__DEV__ || Platform.OS === "web") return <Redirect href="/" />;
  return (
    <SafeAreaView
      edges={
        reason ? ["top", "left", "right", "bottom"] : ["top", "left", "right"]
      }
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Text
        style={{
          ...typography.caption,
          color: colors.muted,
          textAlign: "center",
        }}
      >
        {notice}
      </Text>
      {reason ? (
        <DiscoveryReasonScreen
          row={reason}
          records={data.evidenceRecords}
          saved={wishlist.some(
            (r) => r.productId === reason.product.id && r.saved,
          )}
          busy={false}
          saving={false}
          error=""
          onBack={() => setSelectedProduct(null)}
          onSave={() => setNotice("개발 시안 · 실제 저장은 인증 후 가능해요")}
          onRetry={() => {}}
          onEvidence={() => {}}
        />
      ) : (
        <DiscoveryScreen
          result={data}
          wishlist={wishlist}
          mode={mode}
          category={category}
          onCategory={setCategory}
          onMode={setMode}
          busy={false}
          saving={false}
          error=""
          onSave={(productId) =>
            setWishlist((rows) => {
              const old = rows.find((r) => r.productId === productId);
              return [
                ...rows.filter((r) => r.productId !== productId),
                {
                  productId,
                  saved: !old?.saved,
                  revision: (old?.revision ?? 0) + 1,
                },
              ];
            })
          }
          onRetry={() => {}}
          onBack={() => setMode("discover")}
          onRecord={() => setNotice("개발 시안 · 실제 기록은 인증 후 작성해요")}
          onBegin={() => setNotice("개발 시안 · 기록 시작 행동 확인")}
          onReason={setSelectedProduct}
        />
      )}
      {!reason ? (
        <BottomTabBar
          selected="taste"
          onSelect={() => setMode("discover")}
          onRecord={() => setNotice("개발 시안 · 실제 기록은 인증 후 작성해요")}
        />
      ) : null}
    </SafeAreaView>
  );
}
