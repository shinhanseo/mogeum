import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { colors, fonts, typography } from "../../theme/tokens";
import { SensoryGauge } from "../../components/SensoryGauge";
import { tasteOverview } from "../taste/overview";
import type { TasteSnapshot } from "../../../supabase/functions/_shared/taste-domain";

/** Counts describe recorded observations, never an invented preference score. */
export function HomeTasteMetrics({
  snapshot,
  onEvidence,
  compact = false,
}: {
  snapshot: TasteSnapshot;
  compact?: boolean;
  onEvidence: (factId: string) => void;
}) {
  const { analysis, facts, observationsOnly } = tasteOverview(snapshot);
  const largeText = useWindowDimensions().fontScale > 1.3;
  if (!facts.length) return null;
  return (
    <View style={[s.metrics, compact && { gap: 10 }]}>
      <Text style={s.caption}>
        {observationsOnly ? "관찰한 감각" : "좋게 남긴 잔의 감각"} · 느낌 기록{" "}
        {analysis.recordCount}잔 기준
      </Text>
      {facts.slice(0, compact ? 2 : 3).map((fact) => {
        const positive = fact.positiveIds.length;
        const other = fact.negativeIds.length + fact.neutralIds.length;
        const total = Math.max(analysis.recordCount, positive + other, 1);
        return (
          <Pressable
            key={fact.id}
            style={s.metric}
            accessibilityRole="button"
            accessibilityLabel={`${fact.label}, 좋게 남긴 ${positive}잔, 다른 평가 ${other}잔. 근거 기록 보기`}
            onPress={() => onEvidence(fact.id)}
          >
            <View style={[s.row, largeText && s.stack]}>
              <Text
                style={s.name}
                lineBreakStrategyIOS="hangul-word"
                textBreakStrategy="balanced"
              >
                {fact.label}
              </Text>
              <Text
                style={[s.number, compact && { fontSize: 18, lineHeight: 26 }]}
              >
                {observationsOnly ? positive + other : positive}
                <Text style={s.caption}>/{total}잔 ›</Text>
              </Text>
            </View>
            <SensoryGauge
              positive={positive}
              other={other}
              total={total}
              observed={observationsOnly}
              dark
              compact={compact}
            />
            {!compact ? (
              <Text style={s.caption}>
                {positive > 0 ? `좋게 남긴 ${positive}잔` : ""}
                {positive > 0 && other > 0 ? " · " : ""}
                {other > 0 ? `다른 평가 ${other}잔` : ""}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {!compact ? (
        <Text style={s.caption}>
          {observationsOnly
            ? "느꼈다고 남긴 감각이에요. 좋아한다는 뜻은 아니에요."
            : "좋게 남긴 잔의 감각이에요. 좋아한 이유로 단정하지 않아요."}
        </Text>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  metrics: { gap: 16 },
  metric: { gap: 6, minHeight: 44 },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  stack: { flexDirection: "column", gap: 4 },
  name: { ...typography.nav, color: colors.surface, flexShrink: 1 },
  number: {
    fontSize: 23,
    lineHeight: 32,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  caption: { ...typography.caption, color: colors.onPrimaryMuted },
});
