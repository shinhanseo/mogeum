import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Button } from "../../components/Button";
import { CellarArt } from "../../components/CellarArt";
import { colors, fonts, typography } from "../../theme/tokens";
import { analyzeTaste, selectedFacts, type TasteContext } from "./repository";
import { tasteOverview } from "./overview";
type Props = {
  context: TasteContext | null;
  photos?: Record<string, string>;
  busy?: boolean;
  error?: string;
  onGenerate: () => void;
  onEvidence: (factId?: string, category?: string) => void;
  onRecord: () => void;
  onOpen: (id: string) => void;
  onMenu?: () => void;
  onNext?: () => void;
  onAccount?: () => void;
};
export function TasteScreen({
  context,
  busy = false,
  error = "",
  onGenerate,
  onEvidence,
  onRecord,
  onOpen,
  onNext,
  onMenu,
}: Props) {
  const largeText = useWindowDimensions().fontScale > 1.3;
  const overview = context ? tasteOverview(context.snapshot) : null;
  const analysis = overview?.analysis ?? null;
  const facts = overview?.facts ?? [];
  const observationsOnly = overview?.observationsOnly ?? true;
  const selected =
    analysis && context?.cached && !context.stale
      ? selectedFacts(analysis, context.cached)
      : [];
  const categories = [
    ...new Set(
      context?.snapshot.records
        .map((r) => r.category)
        .filter((c): c is string => !!c) ?? [],
    ),
  ];
  const byCategory = categories.flatMap((category) => {
    const records = context!.snapshot.records.filter(
      (r) => r.category === category,
    );
    const a = analyzeTaste({ ...context!.snapshot, records });
    const f = a.facts.filter((f) => f.positiveIds.length > 0).slice(0, 2);
    return f.length ? [{ category, f }] : [];
  });
  return (
    <ScrollView
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>내 취향</Text>
      <View style={[s.stats, largeText && s.stack]}>
        <Text style={s.caption}>
          느낌 기록 <Text style={s.count}>{analysis?.recordCount ?? 0}</Text>잔
        </Text>
        <Text style={s.caption}>
          서로 다른 술 <Text style={s.count}>{analysis?.drinkCount ?? 0}</Text>
          종
        </Text>
      </View>
      {context && context.snapshot.omittedCount > 0 ? (
        <Text style={s.caption}>
          분석은 최근 {context.snapshot.records.length}개 기록 기준이에요.
        </Text>
      ) : null}
      <View style={s.heading}>
        <Text style={s.caption}>
          {observationsOnly ? "내가 남긴 감각" : "좋게 남긴 잔에서"}
        </Text>
        <Text style={s.subtitle}>
          {observationsOnly ? "기록에서 만난 느낌" : "자주 만난 느낌"}
        </Text>
        <Text style={s.caption}>
          {observationsOnly && facts.length
            ? "느꼈다고 남긴 특징이에요. 좋아한다는 뜻은 아니에요."
            : "느낀 특징을 모았어요. 선호의 확정은 아니에요."}
        </Text>
      </View>
      {context?.stale ? (
        <Text style={s.caption}>
          집계는 최신 기록이에요. AI 공통점은 다시 요약해주세요.
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={s.caption}>
          {error}
        </Text>
      ) : null}
      {busy ? (
        <ActivityIndicator
          accessibilityLabel="취향 요약 중"
          color={colors.primary}
        />
      ) : null}
      {facts.map((fact) => {
        const positive = fact.positiveIds.length,
          other = fact.negativeIds.length + fact.neutralIds.length,
          total = Math.max(analysis!.recordCount, positive + other, 1);
        return (
          <Pressable
            key={fact.id}
            accessibilityRole="button"
            accessibilityLabel={`${fact.label}, 좋게 남긴 ${positive}잔, 다른 평가 ${other}잔. 근거 보기`}
            onPress={() => onEvidence(fact.id)}
            style={s.fact}
          >
            <View style={[s.factTitle, largeText && s.stack]}>
              <Text style={s.factName}>{fact.label}</Text>
              <Text style={s.number}>
                {observationsOnly ? positive + other : positive}
                <Text style={s.caption}>
                  {observationsOnly ? "잔에서 느낌 ›" : " 잔 ›"}
                </Text>
              </Text>
            </View>
            <View style={s.track}>
              {positive > 0 ? (
                <View style={[s.good, { flex: positive / total }]} />
              ) : null}
              {other > 0 ? (
                <View style={[s.other, { flex: other / total }]} />
              ) : null}
              {total > positive + other ? (
                <View style={{ flex: (total - positive - other) / total }} />
              ) : null}
            </View>
            <View style={[s.legend, largeText && s.stack]}>
              {positive > 0 ? (
                <Text style={s.goodLabel}>좋게 남긴 {positive}잔</Text>
              ) : null}
              {other > 0 ? (
                <Text style={s.caption}>다른 평가 {other}잔</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {!context ? (
        <Button label="기록 다시 불러오기" onPress={onGenerate} />
      ) : !facts.length ? (
        <Button
          label={
            context.snapshot.totalRecords
              ? "기록에 느낌 더하기"
              : "첫 한 잔 남기기"
          }
          onPress={onRecord}
        />
      ) : null}
      {facts.length && !observationsOnly ? (
        <View style={s.section}>
          <View style={[s.factTitle, largeText && s.stack]}>
            <Text style={s.sectionTitle}>AI가 골라본 공통점</Text>
            <Button
              label={selected.length ? "다시 살펴보기" : "요약하기"}
              variant="secondary"
              loading={busy}
              onPress={onGenerate}
            />
          </View>
          {selected.length ? (
            <Text style={s.goodLabel}>
              {selected.map((f) => f.label).join(" · ")}
            </Text>
          ) : (
            <Text style={s.caption}>내 기록에서 근거 있는 특징만 골라요.</Text>
          )}
        </View>
      ) : null}
      {byCategory.length ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>주종마다, 조금씩 다르게</Text>
          {byCategory.map(({ category, f }) => (
            <Pressable
              key={category}
              accessibilityRole="button"
              onPress={() => onEvidence(f[0].id, category)}
              style={s.category}
            >
              <CellarArt id={category} category={category} size={48} />
              <View style={s.copy}>
                <Text style={s.factName}>
                  {(
                    {
                      whisky: "위스키",
                      wine: "와인",
                      beer: "맥주",
                      traditional: "전통주",
                    } as Record<string, string>
                  )[category] ?? category}
                </Text>
                <Text style={s.goodLabel}>
                  {f.map((v) => "#" + v.label.replaceAll(" ", "")).join(" ")}
                </Text>
              </View>
              <Text style={s.caption}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {facts[0] ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>이 느낌의 출발점</Text>
          {context!.snapshot.records
            .filter((r) => overview!.originIds.includes(r.id))
            .slice(0, 2)
            .map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                onPress={() => onOpen(r.id)}
                style={s.category}
              >
                <CellarArt id={r.entryId} category={r.category} size={48} />
                <View style={s.copy}>
                  <Text style={s.factName}>{r.name ?? "이름 없는 술"}</Text>
                  <Text style={s.caption}>{r.date.slice(0, 10)}</Text>
                </View>
                <Text style={s.caption}>›</Text>
              </Pressable>
            ))}
        </View>
      ) : null}
      <Button
        label="느낌의 근거 기록 전체 보기"
        variant="secondary"
        onPress={() => onEvidence()}
      />
      {onNext ? (
        <Button label="내 취향으로 다음 한 잔 찾기" onPress={onNext} />
      ) : null}
      {onMenu ? (
        <Button
          label="메뉴판에서 내 취향 찾기"
          variant="secondary"
          onPress={onMenu}
        />
      ) : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  content: { padding: 24, gap: 20, paddingBottom: 32 },
  title: { ...typography.heading, color: colors.text },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  stack: { flexDirection: "column", alignItems: "flex-start", gap: 8 },
  caption: { ...typography.caption, color: colors.muted },
  count: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  heading: {
    marginTop: 20,
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 24,
  },
  subtitle: { ...typography.question, color: colors.text },
  fact: { gap: 12, paddingVertical: 8 },
  factTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  factName: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.text,
    flexShrink: 1,
  },
  number: {
    fontSize: 28,
    lineHeight: 38,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  track: {
    height: 7,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: colors.border,
    flexDirection: "row",
    gap: 3,
  },
  good: { backgroundColor: colors.primary, borderRadius: 3 },
  other: { backgroundColor: colors.chartOther, borderRadius: 3 },
  legend: { flexDirection: "row", gap: 24 },
  goodLabel: { ...typography.caption, color: colors.primary },
  section: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 24,
    gap: 16,
  },
  sectionTitle: { ...typography.nav, color: colors.text, flexShrink: 1 },
  category: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  copy: { flex: 1, gap: 8 },
});
