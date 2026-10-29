import { StatusBar } from "expo-status-bar";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { CellarScreen } from "../../src/features/cellar/CellarScreen";
import { TasteScreen } from "../../src/features/taste/TasteScreen";
import { BottomTabBar, type MainTab } from "../../src/components/BottomTabBar";
import type { TasteContext } from "../../src/features/taste/repository";
import type { Category } from "../../src/features/cellar/model";
import { colors } from "../../src/theme/tokens";
const items = Array.from({ length: 12 }, (_, i) => ({
  id: `synthetic-entry-${i}`,
  name: [
    "합성 발베니 12년",
    "합성 헤페바이스",
    "합성 소비뇽 블랑",
    "합성 손막걸리",
  ][i % 4],
  category: (["위스키", "맥주", "와인", "전통주"] as const)[i % 4],
  photoUri: null,
  recordCount: (i % 3) + 1,
}));
const context: TasteContext = {
  snapshot: {
    hash: "synthetic-preview-only",
    totalRecords: 8,
    omittedCount: 0,
    records: Array.from({ length: 8 }, (_, i) => ({
      id: `synthetic-record-${i}`,
      entryId: `synthetic-entry-${i % 5}`,
      revision: 1,
      category: "whisky",
      name: `합성 테스트 기록 ${i + 1}`,
      date: "2026-10-29",
      revisit: i === 7 ? "not_for_me" : "again",
      rating: null,
      note: {
        mode: "light",
        version: 2,
        inputRevision: 1,
        confirmedInputRevision: 1,
        confirmed: true,
        text: null,
        answers: [
          {
            questionId: "nose",
            status: "answered",
            descriptorCodes: ["fruit"],
          },
          {
            questionId: "body",
            status: "answered",
            descriptorCodes: ["light"],
          },
        ],
      },
    })),
  },
  cached: null,
  stale: false,
  running: false,
};
/** Explicit synthetic native visual fixture. No account, API call or saved record. */
export default function RedesignPreview() {
  const params = useLocalSearchParams<{ screen?: string }>();
  const [tab, setTab] = useState<MainTab>(
    params.screen === "taste" ? "taste" : "cellar",
  );
  const [category, setCategory] = useState<Category | "전체">("전체"),
    [query, setQuery] = useState("");
  if (!__DEV__) return <Redirect href="/" />;
  const filtered = items.filter(
    (i) =>
      (category === "전체" || i.category === category) &&
      i.name.includes(query),
  );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <StatusBar style="dark" />
      <Text style={{ fontSize: 10, textAlign: "center", color: colors.muted }}>
        개발용 합성 시안 · 실제 계정/저장 없음
      </Text>
      <View style={{ flex: 1 }}>
        {tab === "taste" ? (
          <TasteScreen
            context={context}
            onGenerate={() => {}}
            onEvidence={() => {}}
            onRecord={() => {}}
            onOpen={() => {}}
          />
        ) : (
          <CellarScreen
            items={filtered}
            totalCount={items.length}
            loading={false}
            error={false}
            onNext={() => {}}
            onRetry={() => {}}
            category={category}
            onCategory={setCategory}
            query={query}
            onQuery={setQuery}
            onRecord={() => {}}
            onOpen={() => {}}
          />
        )}
      </View>
      <BottomTabBar
        selected={tab}
        onSelect={setTab}
        onRecord={() => {}}
        onAccount={() => {}}
      />
    </SafeAreaView>
  );
}
