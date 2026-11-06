import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { colors, space, typography } from "../../theme/tokens";
import type { RecordComparison } from "./comparison";
import { recordDate } from "./detail";
export function RecordComparisonSection({
  value,
  onOpen,
}: {
  value: RecordComparison;
  onOpen: (id: string) => void;
}) {
  const changed = value.changes.length > 0;
  return (
    <View style={s.section}>
      <Text style={s.caption}>
        {recordDate(value.previousDate)} 기록과 비교
      </Text>
      <Text style={s.title}>
        {changed
          ? "이번엔 조금 다르게 느꼈네요."
          : value.unchanged
            ? "이번에도 비슷한 느낌을 남겼어요."
            : "지난 한 잔과 나란히"}
      </Text>
      {value.changes.slice(0, 3).map((row) => (
        <View key={row.label + row.before} style={s.row}>
          <Text style={s.label}>{row.label}</Text>
          <Text style={s.before}>지난번 {row.before}</Text>
          <Text style={s.after}>이번엔 {row.after}</Text>
        </View>
      ))}
      {value.unchanged > 0 && (
        <Text style={s.body}>
          {value.unchanged}개 항목은 같은 느낌을 골랐어요.
        </Text>
      )}
      {value.revisit && (
        <Text style={s.body}>
          {value.revisit.before === value.revisit.after
            ? `‘${value.revisit.after}’는 그대로예요.`
            : `지난번엔 ‘${value.revisit.before}’, 이번엔 ‘${value.revisit.after}’를 남겼어요.`}
        </Text>
      )}
      {!changed && !value.unchanged && (
        <Text style={s.caption}>
          {value.limited
            ? "노트 작성 방식·빈티지가 다르거나 비교할 답변이 아직 부족해요."
            : "두 기록에 공통으로 답한 향과 맛이 쌓이면 비교해드릴게요."}
        </Text>
      )}
      <Button
        variant="text"
        label="이전 기록 보기  ›"
        onPress={() => onOpen(value.previousId)}
        style={s.link}
      />
    </View>
  );
}
const s = StyleSheet.create({
  section: {
    marginTop: space.xl,
    paddingTop: space.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  caption: { ...typography.caption, color: colors.muted },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.text },
  label: { ...typography.fieldLabel, color: colors.text },
  row: { gap: space.xs, paddingVertical: space.sm },
  before: { ...typography.body, color: colors.muted },
  after: { ...typography.body, color: colors.primary },
  link: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 0 },
});
