import { generationCopy } from "../discovery/generation-copy";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getSupabase } from "../../lib/supabase";
import { colors, fonts, typography } from "../../theme/tokens";
import { CellarArt } from "../../components/CellarArt";
import { Button } from "../../components/Button";
import {
  loadTasteContext,
  tastePhotoUrls,
  analyzeTaste,
} from "../taste/repository";
import { loadDiscovery } from "../discovery/repository";
import { createHomeLoader, type HomeLoadState } from "./latest";
import { HomeCarousel } from "./HomeCarousel";
import { HomeMenuSlide } from "./HomeMenuSlide";
import { HomeTasteMetrics } from "./HomeTasteMetrics";
export function HomePanel({
  owner,
  onRecord,
  onCellar,
  onTaste,
}: {
  owner: string | null;
  onRecord: () => void;
  onCellar: () => void;
  onTaste: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<HomeLoadState>({ status: "loading" });
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const width = Math.min(windowWidth, 600);
  const loader = useMemo(
    () =>
      createHomeLoader({
        async context() {
          const client = getSupabase();
          if (!client || !owner) throw Error("NO_CLIENT");
          return loadTasteContext(client);
        },
        async photos(context) {
          const client = getSupabase();
          if (!client || !owner) return {};
          return tastePhotoUrls(
            client,
            owner,
            [...context.snapshot.records]
              .sort(
                (a, b) =>
                  b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
              )
              .slice(0, 2)
              .map((record) => record.id),
          );
        },
        async discovery() {
          const client = getSupabase();
          if (!client || !owner) throw Error("NO_CLIENT");
          return loadDiscovery(client, owner, null, {weekly: true});
        },
        publish: setState,
      }),
    [owner],
  );
  const refresh = useCallback(() => {
    if (owner) void loader.load();
  }, [loader, owner]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener("change", (next) => {
        if (next === "active") refresh();
        else {
          loader.cancel();
          setState({ status: "loading" });
        }
      });
      return () => {
        loader.cancel();
        sub.remove();
      };
    }, [loader, refresh]),
  );
  const data = state.status === "ready" ? state.data : null;
  const failed = state.status === "failed";
  const analysis = data ? analyzeTaste(data.context.snapshot) : null;
  const facts = analysis?.facts ?? [];
  const recommendationCopy = generationCopy(data?.discovery?.generation);
  const recommendations = data?.discovery?.recommendations ?? [];
  const unique = recommendations
    .filter(
      (row, i) =>
        recommendations.findIndex(
          (r) => r.product.category === row.product.category,
        ) === i,
    )
    .slice(0, 4);
  const pagerKey = `${data?.context.snapshot.hash ?? "empty"}:${unique.map((row) => row.product.id).join(":")}:${width}`;
  const loading = Boolean(owner && !data && !failed);
  const hasPositive = facts.some((fact) => fact.positiveIds.length > 0);
  const pages = [
    ...unique.map((row) => {
      const match = row.similar[0];
      const source = data?.context.snapshot.records.find((record) =>
        match?.recordIds.includes(record.id),
      );
      return {
        title: row.product.name,
        eyebrow: "내 기록에서 이어지는 한 잔",
        description: source?.name
          ? `${source.name}에서 좋게 남긴 ${match.label}. 이 술의 제품 설명에도 같은 특징이 있어요.`
          : `${row.similar
              .slice(0, 2)
              .map((f) => f.label)
              .join(" · ")}을 좋게 남긴 기록과 이어져요.`,
        hint: row.cautions.length
          ? `${row.cautions[0].label}은 아쉽게 남긴 기록도 있어요. 함께 살펴봐요.`
          : row.unconfirmedFeatures.length
            ? `${row.unconfirmedFeatures[0].label}은 새롭게 살펴볼 특징이에요. 아직 내 선호는 몰라요.`
            : "제품 설명과 내 경험은 다를 수 있어요. 닮은 점부터 골라봤어요.",
        category: row.product.category,
        meta: `${{ whisky: "위스키", wine: "와인", beer: "맥주", traditional: "전통주" }[row.product.category]} · ${row.product.edition}`,
        id: row.product.id,
        action: () =>
          router.push({
            pathname: "/discovery",
            params: { productId: row.product.id },
          }),
        link: "내 기록과 비교하기",
      };
    }),
    {
      title: loading
        ? "내 기록을\n살펴보고 있어요"
        : hasPositive
          ? "내가 자주 남긴 감각"
          : facts.length
            ? "기록에서 만난 감각"
            : "한 잔의 느낌부터\n모아볼까요?",
      eyebrow: "내 기록에서 발견한 느낌",
      meta: "내가 직접 남긴 감각",
      description: hasPositive
        ? (() => {
            const f = facts.find((f) => f.positiveIds.length > 0)!;
            return `“${f.label}” — 좋게 남긴 ${f.positiveIds.length}잔에 이 감각을 기록했어요. 이 술들을 좋아한 이유라고 단정하지는 않아요.`;
          })()
        : facts.length
          ? "남긴 감각과 평가를 함께 확인해요."
          : "사진에 느낌을 더하면 취향을 살펴볼 수 있어요.",
      hint: facts.length
        ? `느낌을 남긴 ${analysis?.recordCount ?? 0}잔에서 살펴봤어요. 기록을 더하면 발견도 달라져요.`
        : "좋았는지와 느낀 감각을 남기면, 다음 한 잔을 고를 때 활용해요.",
      category: null,
      id: "taste",
      action: onTaste,
      link: "내 취향 살펴보기",
    },
    {
      title: "메뉴판에서\n내 취향 찾기",
      eyebrow: "지금 메뉴판 앞이라면",
      meta: "사진 여러 장도 한 번에",
      description:
        "낯선 술 이름 사이에서, 내가 좋게 남긴 향과 맛이 닮은 메뉴를 찾아봐요.",
      hint: "사진 올리기 → 읽은 메뉴 확인 → 내 기록과 비교. 확실히 찾지 못한 술은 따로 알려줘요.",
      category: null,
      id: "menu",
      action: () => router.push(owner ? "/menu" : "/login"),
      link: "메뉴판 올리기",
    },
  ];
  const recent = [...(data?.context.snapshot.records ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 2);
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.content}
    >
      <View style={s.hero}>
        <View style={s.brandRow}>
          <Text style={s.brand}>모금</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="계정 관리"
            onPress={() => router.push(owner ? "/account" : "/login")}
            style={s.account}
          >
            <Text style={s.white}>설정</Text>
          </Pressable>
        </View>
        {data?.recommendationState === "loading" ? (
          <Text style={s.recommendationStatus}>
            다음 한 잔을 살펴보고 있어요.
          </Text>
        ) : data?.recommendationState === "unavailable" ? (
          <Pressable
            accessibilityRole="button"
            onPress={refresh}
            style={s.retryRecommendation}
          >
            <Text style={s.hint}>추천을 불러오지 못했어요. 다시 시도 ›</Text>
          </Pressable>
        ) : recommendationCopy && !recommendations.length ? (
          <Text style={s.recommendationStatus}>{recommendationCopy.body}</Text>
        ) : null}
        <HomeCarousel
          key={pagerKey}
          width={width}
          labels={pages.map((page) => page.title)}
        >
          {pages.map((page) =>
            page.id === "menu" ? (
              <HomeMenuSlide key={page.id} onOpen={page.action} />
            ) : (
              <View key={page.id} style={s.slide}>
                <Text style={s.eyebrow}>{page.eyebrow}</Text>
                {page.id !== "taste" ? (
                  <Text style={s.meta}>{page.meta}</Text>
                ) : null}
                <View style={s.lead}>
                  <Text
                    lineBreakStrategyIOS="hangul-word"
                    textBreakStrategy="balanced"
                    style={s.title}
                    numberOfLines={fontScale <= 1.3 ? 2 : undefined}
                  >
                    {page.title}
                  </Text>
                  {page.category ? (
                    <CellarArt
                      id={page.id}
                      category={page.category}
                      size={82}
                    />
                  ) : null}
                </View>
                <View style={s.rule} />
                {page.id === "taste" && data && facts.length ? (
                  <HomeTasteMetrics
                    compact
                    snapshot={data.context.snapshot}
                    onEvidence={(factId) =>
                      router.push({
                        pathname: "/taste-evidence",
                        params: { factId },
                      })
                    }
                  />
                ) : (
                  <>
                    <Text
                      lineBreakStrategyIOS="hangul-word"
                      textBreakStrategy="balanced"
                      style={s.description}
                      numberOfLines={fontScale <= 1.3 ? 2 : undefined}
                    >
                      {page.description}
                    </Text>
                    <Text
                      style={s.hint}
                      numberOfLines={fontScale <= 1.3 ? 2 : undefined}
                    >
                      {page.hint}
                    </Text>
                  </>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={page.action}
                  style={s.heroAction}
                >
                  <Text style={s.action}>{page.link}</Text>
                  <Text style={s.white}>›</Text>
                </Pressable>
              </View>
            ),
          )}
        </HomeCarousel>
      </View>
      <View style={s.records}>
        <View style={[s.sectionRow, fontScale > 1.3 && s.sectionStack]}>
          <Text style={s.sectionTitle}>최근 테이스팅 노트</Text>
          <Pressable
            onPress={onCellar}
            accessibilityRole="button"
            style={s.sectionLink}
          >
            <Text style={s.caption}>전체 보기 ›</Text>
          </Pressable>
        </View>
        {owner && !data && !failed ? (
          <ActivityIndicator
            accessibilityLabel="내 기록 불러오는 중"
            color={colors.primary}
          />
        ) : null}
        {failed ? (
          <>
            <Text accessibilityRole="alert" style={s.caption}>
              기록을 불러오지 못했어요.
            </Text>
            <Button
              label="다시 불러오기"
              variant="secondary"
              onPress={() => void refresh()}
            />
          </>
        ) : null}
        {recent.map((record) => (
          <Pressable
            key={record.id}
            accessibilityRole="button"
            accessibilityLabel={`${record.name ?? "이름 없는 술"} 기록 보기`}
            style={s.record}
            onPress={() =>
              router.push({
                pathname: "/detail",
                params: { recordId: record.id },
              })
            }
          >
            <RecordThumbnail
              uri={data?.photos[record.id]}
              id={record.entryId}
              category={record.category}
            />
            <View style={s.copy}>
              <Text style={s.caption}>
                {record.date.slice(0, 10).replaceAll("-", ".")}{" "}
              </Text>
              <Text numberOfLines={2} style={s.recordName}>
                {record.name ?? "이름 없는 술"}
              </Text>
              <Text numberOfLines={2} style={s.tags}>
                {facts
                  .filter((f) =>
                    [
                      ...f.positiveIds,
                      ...f.negativeIds,
                      ...f.neutralIds,
                    ].includes(record.id),
                  )
                  .slice(0, 3)
                  .map((f) => "#" + f.label.replaceAll(" ", ""))
                  .join(" ") || "느낌 남기기"}
              </Text>
            </View>
            <Text style={s.caption}>›</Text>
          </Pressable>
        ))}
        {!recent.length && (!owner || data) ? (
          <>
            <Text style={s.caption}>마신 한 잔부터 차곡차곡 모아보세요.</Text>
            <Button label="첫 기록 남기기" onPress={onRecord} />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
function RecordThumbnail({
  uri,
  id,
  category,
}: {
  uri?: string;
  id: string;
  category: string | null;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return uri && failedUri !== uri ? (
    <Image source={{ uri }} style={s.photo} onError={() => setFailedUri(uri)} />
  ) : (
    <CellarArt id={id} category={category} size={72} />
  );
}
const s = StyleSheet.create({
  content: { paddingBottom: 24 },
  hero: { backgroundColor: colors.primary },
  recommendationStatus: {
    ...typography.caption,
    color: colors.onPrimaryMuted,
    paddingHorizontal: 24,
  },
  retryRecommendation: {
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: "center",
  },
  brandRow: {
    paddingHorizontal: 24,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { ...typography.title, color: colors.surface },
  account: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  white: { ...typography.body, color: colors.surface },
  slide: { paddingHorizontal: 24, paddingVertical: 12, gap: 6 },
  meta: { ...typography.caption, color: colors.onPrimaryMuted },
  rule: {
    height: 1,
    backgroundColor: colors.onPrimaryMuted,
    opacity: 0.35,
    marginVertical: 4,
  },
  eyebrow: { ...typography.caption, color: colors.onPrimaryMuted },
  lead: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    flex: 1,
    fontSize: 24,
    lineHeight: 32,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  description: { ...typography.body, color: colors.surface },
  hint: { ...typography.caption, color: colors.onPrimaryMuted },
  heroAction: {
    marginTop: 4,
    paddingTop: 0,
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  action: { ...typography.body, fontFamily: fonts.bold, color: colors.surface },
  records: { padding: 24, gap: 20 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionStack: { flexDirection: "column", alignItems: "flex-start", gap: 4 },
  sectionLink: { minHeight: 44, justifyContent: "center" },
  sectionTitle: { ...typography.nav, color: colors.text, flexShrink: 1 },
  caption: { ...typography.caption, color: colors.muted },
  record: {
    flexDirection: "row",
    gap: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  photo: { width: 72, height: 72, borderRadius: 3 },
  copy: { flex: 1, gap: 6 },
  recordName: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  tags: { ...typography.caption, color: colors.primary },
});
