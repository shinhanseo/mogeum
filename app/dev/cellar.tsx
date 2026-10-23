import { useEffect, useRef, useState } from "react";
import { Image, Platform, Text } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CellarScreen } from "../../src/features/cellar/CellarScreen";
import { BottomTabBar } from "../../src/components/BottomTabBar";
import {
  createCellarPager,
  emptyCellarState,
} from "../../src/features/cellar/pager";
import type { CellarFilter } from "../../src/features/cellar/repository";
import type { Category } from "../../src/features/cellar/model";
import { colors, typography } from "../../src/theme/tokens";
export default function CellarPreview() {
  const [state, setState] = useState(emptyCellarState),
    [category, setCategory] = useState<Category | "전체">("전체"),
    [query, setQuery] = useState("");
  const pager = useRef<ReturnType<typeof createCellarPager> | null>(null);
  useEffect(() => {
    if (!__DEV__ || Platform.OS === "web") return;
    const photo =
      Image.resolveAssetSource(
        require("../../assets/fixtures/figma-whisky.jpg"),
      )?.uri ?? null;
    const all = Array.from({ length: 61 }, (_, n) => ({
      id: String(n),
      name: `합성 위스키 ${n + 1}`,
      category: "위스키" as const,
      photoUri: photo,
      recordCount: 1,
    }));
    const current = createCellarPager(async (filter: CellarFilter, cursor) => {
      const rows = all.filter(
        (i) =>
          (filter.category === "전체" || filter.category === i.category) &&
          i.name.includes(filter.query),
      );
      const offset = cursor ? Number(cursor.id) : 0,
        items = rows.slice(offset, offset + 30);
      return {
        items,
        total: all.length,
        next:
          offset + 30 < rows.length
            ? { date: null, id: String(offset + 30) }
            : null,
      };
    }, setState);
    pager.current = current;
    void current.reset({ category, query });
    return () => {
      current.cancel();
      pager.current = null;
    };
  }, [category, query]);
  if (!__DEV__ || Platform.OS === "web") return <Redirect href="/" />;
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Text style={{ ...typography.caption, color: colors.muted }}>
        개발용 합성 61개 · 불러옴 {state.items.length} · 서버 미호출
      </Text>
      <CellarScreen
        items={state.items}
        totalCount={state.total}
        loading={state.loading}
        error={state.error}
        onNext={() => void pager.current?.next()}
        onRetry={() => void pager.current?.retry()}
        category={category}
        onCategory={setCategory}
        query={query}
        onQuery={setQuery}
        onRecord={() => {}}
        onOpen={() => {}}
      />
      <BottomTabBar selected="cellar" onSelect={() => {}} onRecord={() => {}} />
    </SafeAreaView>
  );
}
