import { Image, Text, View } from "react-native";
import { Redirect,useLocalSearchParams } from "expo-router";
import { MenuFlow } from "../../src/features/menu/MenuFlow";
import {
  parseMenu,
  recommendMenu,
} from "../../supabase/functions/_shared/menu-domain";
import { colors, typography } from "../../src/theme/tokens";
import type { TasteSnapshot } from "../../supabase/functions/_shared/taste-domain";
const snapshot: TasteSnapshot = {
  hash: "explicit-menu-fixture",
  totalRecords: 1,
  omittedCount: 0,
  records: [
    {
      id: "fixture-record",
      entryId: "fixture-entry",
      revision: 1,
      name: "기록용 위스키",
      category: "whisky",
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
          {
            questionId: "nose",
            status: "answered",
            descriptorCodes: ["fruit"],
          },
        ],
      },
    },
  ],
};
export default function DevMenu() {
 const {picker}=useLocalSearchParams<{picker?:string}>();
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
        owner={picker==='1'?'menu-picker-fixture':'menu-ocr-fixture'}
        fixtureEvidenceUri={
          Image.resolveAssetSource(
            require("../../assets/fixtures/figma-whisky.jpg"),
          )!.uri
        }
        fixtureUri={picker==='1'?undefined:
          Image.resolveAssetSource(
            require("../../assets/fixtures/menu-synthetic.png"),
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
              noteText: "과일 향이 떠올랐어요.",
            })),
            tasteHash: snapshot.hash,
            recordCount: 1,
            method: "explicit-fixture",
            limitedCatalog: true,
          }),
        }}
      />
    </View>
  );
}
