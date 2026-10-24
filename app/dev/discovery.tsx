import { useState } from "react";
import { Platform, Text } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
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
export default function DiscoveryPreview() {
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
      edges={["top", "left", "right"]}
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
      <DiscoveryScreen
        result={preview}
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
        onEvidence={() => {}}
      />
      <BottomTabBar
        selected="taste"
        onSelect={() => setMode("discover")}
        onRecord={() => setNotice("개발 시안 · 실제 기록은 인증 후 작성해요")}
      />
    </SafeAreaView>
  );
}
