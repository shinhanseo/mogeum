import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme/tokens";
/** Read-only record frequency. It is deliberately not an adjustable slider. */
export function SensoryGauge({
  positive,
  other,
  total,
  observed = false,
  dark = false,
  compact = false,
}: {
  positive: number;
  other: number;
  total: number;
  observed?: boolean;
  dark?: boolean;
  compact?: boolean;
}) {
  const denominator = Math.max(total, positive + other, 1);
  const foreground = dark ? colors.surface : colors.primary;
  return (
    <View style={s.gauge} accessible={false}>
      <View style={[s.railArea, compact && { height: 18 }]}>
        <View
          style={[
            s.track,
            { backgroundColor: dark ? "#FFFFFF18" : colors.border },
          ]}
        >
          {positive > 0 ? (
            <View style={{ flex: positive, backgroundColor: foreground }} />
          ) : null}
          {other > 0 ? (
            <View style={{ flex: other, backgroundColor: colors.chartOther }} />
          ) : null}
          {denominator > positive + other ? (
            <View style={{ flex: denominator - positive - other }} />
          ) : null}
        </View>
        <View
          style={[
            s.point,
            {
              top: compact ? 3 : 5,
              left: `${((observed ? positive + other : positive) / denominator) * 100}%`,
              borderColor: foreground,
              backgroundColor: dark ? colors.primary : colors.background,
            },
          ]}
        />
      </View>
      {!compact ? (
        <View style={s.ends}>
          <Text
            style={[
              s.axis,
              { color: dark ? colors.onPrimaryMuted : colors.muted },
            ]}
          >
            0잔
          </Text>
          <Text
            style={[
              s.axis,
              { color: dark ? colors.onPrimaryMuted : colors.muted },
            ]}
          >
            {denominator}잔
          </Text>
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  gauge: { paddingHorizontal: 6 },
  railArea: { height: 22, justifyContent: "center" },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    flexDirection: "row",
  },
  point: {
    position: "absolute",
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    borderWidth: 2,
  },
  ends: { flexDirection: "row", justifyContent: "space-between" },
  axis: { ...typography.caption, fontSize: 10 },
});
