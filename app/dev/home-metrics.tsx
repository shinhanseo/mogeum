import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeTasteMetrics } from "../../src/features/home/HomeTasteMetrics";
import { colors, typography } from "../../src/theme/tokens";
import type { TasteSnapshot } from "../../supabase/functions/_shared/taste-domain";
const snapshot: TasteSnapshot = {
  hash: "synthetic-home-metrics",
  totalRecords: 5,
  omittedCount: 0,
  records: Array.from({ length: 5 }, (_, i) => ({
    id: `synthetic-${i}`,
    entryId: `synthetic-${i}`,
    revision: 1,
    category: "whisky",
    name: "합성 시안",
    date: "2026-10-30",
    revisit: i === 4 ? "okay" : "again",
    rating: null,
    note: {
      mode: "light",
      version: 2,
      inputRevision: 1,
      confirmedInputRevision: 1,
      confirmed: true,
      answers: [
        {
          questionId: "nose",
          status: "answered",
          descriptorCodes: [i < 3 ? "fruit" : "smoke"],
        },
        { questionId: "body", status: "answered", descriptorCodes: ["light"] },
      ],
    },
  })),
};
export default function HomeMetricsPreview() {
  const { observed, compact } = useLocalSearchParams<{
    observed?: string;
    compact?: string;
  }>();
  const [selected, setSelected] = useState("");
  if (!__DEV__) return <Redirect href="/" />;
  const value = observed
    ? {
        ...snapshot,
        records: snapshot.records.map((record) => ({
          ...record,
          revisit: "okay",
        })),
      }
    : snapshot;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <Text style={{ ...typography.caption, color: colors.onPrimaryMuted }}>
          개발용 합성 기록 · 저장/AI 호출 없음
        </Text>
        <Text style={{ ...typography.question, color: colors.surface }}>
          내 기록에서 발견한 느낌
        </Text>
        <HomeTasteMetrics
          compact={!!compact}
          snapshot={value}
          onEvidence={setSelected}
        />
        <Text style={{ ...typography.caption, color: colors.onPrimaryMuted }}>
          {selected
            ? `선택한 근거: ${selected}`
            : "지표를 눌러 근거 ID 전달을 확인해요."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
