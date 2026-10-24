import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import type {
  NextDrink,
  ProductMatch,
} from "../../../supabase/functions/_shared/next-drinks-domain";
import { Button } from "../../components/Button";
import { colors, layout, radius, space, typography } from "../../theme/tokens";
import type { DiscoveryResult } from "./contract";
import { categoryLabels } from "./DiscoveryScreen";
import { DrinkArt } from "./DrinkArt";
import { reasonEvidence } from "./reason";

type Props = {
  row: NextDrink;
  records: DiscoveryResult["evidenceRecords"];
  saved: boolean;
  busy: boolean;
  saving: boolean;
  error: string;
  onBack: () => void;
  onSave: () => void;
  onRetry: () => void;
  onEvidence: (recordId: string) => void;
};
/** Latest 04 / 19:926, high-fidelity context captured 2026-10-24. No tab bar on this view. */
export function DiscoveryReasonScreen(props: Props) {
  const { row, records } = props;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState("");
  function comparison(match: ProductMatch, kind: "positive" | "negative") {
    const evidence = reasonEvidence(match, records, kind);
    const key = `${kind}:${match.factId}`;
    return (
      <View key={key} style={[s.card, kind === "positive" && s.similar]}>
        <Text style={[s.label, kind === "positive" && s.brand]}>
          {kind === "positive" ? "닮은 점" : "다르게 느낄 수 있는 점"} ·{" "}
          {match.label}
        </Text>
        <Text style={s.body}>
          {kind === "positive" ? "좋게" : "아쉽게"} 남긴 기록 {evidence.length}
          개에서 이 느낌을 남겼어요.{"\n"}이 술의 제품 설명에도 같은 특징이
          있어요.
        </Text>
        <Button
          variant="text"
          label={
            expanded === key
              ? "비교 기록 접기  ‹"
              : "비교에 쓰인 내 기록 보기  ›"
          }
          style={s.textAction}
          onPress={() => setExpanded(expanded === key ? null : key)}
        />
        {expanded === key ? (
          <View style={s.evidence}>
            {evidence.map((record) => (
              <View key={record.id} style={s.evidenceRow}>
                <Text style={s.caption}>
                  {record.date.slice(0, 10)} ·{" "}
                  {kind === "positive" ? "좋게 남긴 기록" : "아쉽게 남긴 기록"}
                </Text>
                <Button
                  variant="text"
                  label={`${record.name ?? "이름 없는 술"} 기록 보기  ›`}
                  style={s.textAction}
                  onPress={() => props.onEvidence(record.id)}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={s.content}>
        <Button
          variant="text"
          label="‹  다음 한 잔"
          onPress={props.onBack}
          style={s.back}
        />
        <Text style={s.heading}>
          {row.kind === "explore"
            ? "내 취향과 비교해볼까요?"
            : "왜 나와 잘 맞을까요?"}
        </Text>
        <View style={s.identity}>
          <DrinkArt category={row.product.category} />
          <View style={s.product}>
            <Text style={s.name}>{row.product.name}</Text>
            <Text style={s.caption}>
              {categoryLabels[row.product.category]} · {row.product.edition}
            </Text>
            <Text style={[s.body, s.brand]}>
              {row.product.features.map((f) => f.label).join(" · ")}
            </Text>
          </View>
        </View>
        {row.similar.map((match) => comparison(match, "positive"))}
        {!row.similar.length ? (
          <View style={[s.card, s.similar]}>
            <Text style={[s.label, s.brand]}>
              아직 좋아한다고 말할 근거는 없어요
            </Text>
            <Text style={s.body}>
              제품의 향과 맛을 먼저 둘러보세요. 마신 뒤 남기는 느낌으로 비교할
              수 있어요.
            </Text>
          </View>
        ) : null}
        {row.cautions.map((match) => comparison(match, "negative"))}
        {row.unconfirmedFeatures.length ? (
          <View style={s.card}>
            <Text style={s.label}>아직 내 취향과 비교하지 못한 점</Text>
            <Text style={s.secondary}>
              {row.unconfirmedFeatures.map((f) => f.label).join(" · ")}
              {"\n"}제품 설명에는 있지만, 내 기록에는 이 특징의 선호가 아직
              없어요.
            </Text>
          </View>
        ) : null}
        <View style={s.card}>
          <Text style={s.label}>제품 정보의 근거</Text>
          <Text style={s.caption}>
            {row.product.source.title}
            {"\n"}
            {row.product.source.kind === "producer"
              ? "생산자 설명"
              : "전문 테이스팅 자료"}{" "}
            · {row.product.source.checkedAt} 확인
          </Text>
          <Text style={s.secondary}>{row.product.description}</Text>
          <Button
            variant="text"
            label={
              row.product.source.kind === "producer"
                ? "생산자 설명 확인  ↗"
                : "원문 설명 확인  ↗"
            }
            style={s.textAction}
            onPress={() => {
              setSourceError("");
              void Linking.openURL(row.product.source.url).catch(() =>
                setSourceError(
                  "제품 정보 페이지를 열지 못했어요. 다시 눌러주세요.",
                ),
              );
            }}
          />
          {sourceError ? (
            <Text accessibilityRole="alert" style={s.caption}>
              {sourceError}
            </Text>
          ) : null}
        </View>
        <Text style={s.caption}>
          취향 적합도를 확률이나 점수로 단정하지 않아요. 출처 있는 제품 특징과
          내 기록을 비교했어요.
        </Text>
        {props.error ? (
          <View style={s.evidence}>
            <Text accessibilityRole="alert" style={[s.body, s.brand]}>
              {props.error}
            </Text>
            <Button
              variant="secondary"
              label="다시 확인"
              onPress={props.onRetry}
              loading={props.busy || props.saving}
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={s.footer}>
        <Button
          label={
            props.saved
              ? "마셔보고 싶은 술에서 해제"
              : "+ 마셔보고 싶은 술에 저장"
          }
          onPress={props.onSave}
          loading={props.saving}
          disabled={props.busy || !!props.error}
        />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: layout.screenPadding, gap: space.lg },
  back: {
    width: 144,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  heading: { ...typography.question, color: colors.text },
  identity: { flexDirection: "row", gap: space.lg, alignItems: "flex-start" },
  product: { flex: 1, gap: space.xs },
  name: { ...typography.title, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
  label: { ...typography.fieldLabel, color: colors.text },
  body: { ...typography.body, color: colors.text },
  secondary: { ...typography.body, color: colors.muted },
  brand: { color: colors.primary },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  similar: { backgroundColor: colors.selected },
  textAction: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 0 },
  evidence: { gap: space.md },
  evidenceRow: { gap: space.xs },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: space.lg,
  },
});
