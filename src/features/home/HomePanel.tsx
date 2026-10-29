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
  const [position, setPosition] = useState({ key: "", index: 0 });
  const width = Math.min(useWindowDimensions().width, 600);
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
          return loadDiscovery(client, owner);
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
  const facts = data ? analyzeTaste(data.context.snapshot).facts : [];
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
  const slide = position.key === pagerKey ? position.index : 0;
  const loading = Boolean(owner && !data && !failed);
  const hasPositive = facts.some((fact) => fact.positiveIds.length > 0);
  const pages = [
    ...unique.map((row) => ({
      title: row.product.name,
      eyebrow: "내 기록에서 이어지는 한 잔",
      description: row.similar
        .slice(0, 2)
        .map((f) => f.label)
        .join(" · "),
      hint: row.cautions.length
        ? "다른 느낌도 함께 확인해요."
        : "제품 특징과 내 기록의 닮은 점을 확인해요.",
      category: row.product.category,
      id: row.product.id,
      action: () =>
        router.push({
          pathname: "/discovery",
          params: { productId: row.product.id },
        }),
      link: "왜 골랐는지 보기",
    })),
    {
      title: loading
        ? "내 기록을\n살펴보고 있어요"
        : (facts.find((f) => f.positiveIds.length > 0)?.label ??
          "한 잔의 느낌부터\n모아볼까요?"),
      eyebrow: "내 기록에서 발견한 느낌",
      description: hasPositive
        ? "좋게 남긴 특징과 다른 평가를 함께 살펴봐요."
        : "사진에 느낌을 더하면 취향을 살펴볼 수 있어요.",
      hint: "내가 남긴 기록이 다음 선택의 출발점이에요.",
      category: null,
      id: "taste",
      action: onTaste,
      link: "내 취향 살펴보기",
    },
    {
      title: "메뉴판에서\n내 취향 찾기",
      eyebrow: "지금 메뉴판 앞이라면",
      description: "여러 장을 모아 내 기록과 비교해요.",
      hint: "읽은 이름·가격·용량을 직접 확인할 수 있어요.",
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
        ) : null}
        <ScrollView
          key={pagerKey}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setPosition({
              key: pagerKey,
              index: Math.round(e.nativeEvent.contentOffset.x / width),
            })
          }
        >
          {pages.map((page) => (
            <View key={page.id} style={[s.slide, { width }]}>
              <Text style={s.eyebrow}>{page.eyebrow}</Text>
              <View style={s.lead}>
                <Text style={s.title}>{page.title}</Text>
                {page.category ? (
                  <CellarArt id={page.id} category={page.category} size={82} />
                ) : null}
              </View>
              <Text style={s.description}>{page.description}</Text>
              <Text style={s.hint}>{page.hint}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={page.action}
                style={s.heroAction}
              >
                <Text style={s.action}>{page.link}</Text>
                <Text style={s.white}>›</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
      <View
        accessible
        accessibilityLabel={`추천 정보 ${Math.min(slide + 1, pages.length)} / ${pages.length}`}
        style={s.dots}
      >
        {pages.map((page, i) => (
          <View
            key={page.id}
            style={[
              s.dot,
              Math.min(slide, pages.length - 1) === i && s.activeDot,
            ]}
          />
        ))}
      </View>
      <View style={s.records}>
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>최근 테이스팅 노트</Text>
          <Pressable onPress={onCellar} accessibilityRole="button">
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
  slide: { padding: 24, minHeight: 330, gap: 16 },
  eyebrow: { ...typography.caption, color: colors.onPrimaryMuted },
  lead: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    flex: 1,
    fontSize: 25,
    lineHeight: 36,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  description: { ...typography.body, color: colors.surface },
  hint: { ...typography.caption, color: colors.onPrimaryMuted },
  heroAction: {
    marginTop: "auto",
    paddingTop: 16,
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  action: { ...typography.body, fontFamily: fonts.bold, color: colors.surface },
  dots: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  activeDot: { width: 12, backgroundColor: colors.primary },
  records: { padding: 24, gap: 20 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { ...typography.nav, color: colors.text },
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
