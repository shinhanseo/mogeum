import { Image, Text, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { MenuFlow } from "../../src/features/menu/MenuFlow";
import {
  parseMenu,
  recommendMenu,
} from "../../supabase/functions/_shared/menu-domain";
import { colors, typography } from "../../src/theme/tokens";
import type { TasteSnapshot } from "../../supabase/functions/_shared/taste-domain";
const snapshot: TasteSnapshot = {
  hash: "explicit-menu-fixture",
  totalRecords: 4,
  omittedCount: 0,
  records: [
    ["whisky", "fruit"],
    ["wine", "citrus"],
    ["beer", "citrus"],
    ["traditional", "rice_grain"],
  ].map(([category, code]) => ({
    id: `fixture-${category}`,
    entryId: `fixture-${category}`,
    revision: 1,
    name: `합성 ${category} 기록`,
    category,
    date: "2026-10-23",
    rating: null,
    revisit: "again",
    note: {
      mode: "light",
      version: 2,
      inputRevision: 1,
      confirmedInputRevision: 1,
      confirmed: true,
      answers: [
        { questionId: "nose", status: "answered", descriptorCodes: [code] },
      ],
    },
  })),
};
export default function DevMenu() {
  const { picker, catalog } = useLocalSearchParams<{
    picker?: string;
    catalog?: string;
  }>();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          ...typography.caption,
          color: colors.primary,
          textAlign: "center",
          backgroundColor: colors.selected,
        }}
      >
        개발 검증 · 실제 기기 OCR / 합성 취향 / 서버 호출 없음
      </Text>
      <MenuFlow
        owner={
          catalog === "1"
            ? "menu-catalog-fixture"
            : picker === "1"
              ? "menu-picker-fixture"
              : "menu-ocr-fixture"
        }
        fixtureEvidenceUri={
          Image.resolveAssetSource(
            require("../../assets/fixtures/figma-whisky.jpg"),
          )!.uri
        }
        fixtureUri={
          picker === "1"
            ? undefined
            : Image.resolveAssetSource(
                catalog === "1"
                  ? require("../../assets/fixtures/menu-catalog-synthetic.png")
                  : require("../../assets/fixtures/menu-synthetic.png"),
              )!.uri
        }
        adapter={{
          parse: async (photos) => parseMenu(photos),
          save: async (d) => d.revision + 1,
          recommend: async (_photos, items) => ({
            recommendations: recommendMenu(items, snapshot),
            evidenceRecords: snapshot.records.map((r) => ({
              id: r.id,
              name: r.name,
              date: r.date,
              revision: r.revision,
              category: r.category,
              revisit: r.revisit,
              noteText: "개발 검증용 합성 향 기록이에요.",
            })),
            tasteHash: snapshot.hash,
            recordCount: snapshot.totalRecords,
            method: "explicit-fixture",
            limitedCatalog: true,
          }),
        }}
      />
    </View>
  );
}
