import { personalizedDrinks } from "../../../supabase/functions/_shared/next-drinks-domain";
import { Mogu } from "../../components/Mogu";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "../../components/Button";
import { ChoiceChip } from "../../components/ChoiceChip";
import { colors, layout, radius, space, typography } from "../../theme/tokens";
import {
  products,
  type Product,
} from "../../../supabase/functions/_shared/product-catalog";
import type { NextDrink } from "../../../supabase/functions/_shared/next-drinks-domain";
import type { DiscoveryResult } from "./contract";
import type { WishlistState } from "./wishlist";
import { BookmarkArt, DrinkArt } from "./DrinkArt";
export const categoryLabels = {
  whisky: "위스키",
  beer: "맥주",
  wine: "와인",
  traditional: "전통주",
} as const;
const filters = [null, "whisky", "beer", "wine", "traditional"] as const;
type Props = {
  result: DiscoveryResult | null;
  wishlist: WishlistState[];
  mode: "discover" | "saved";
  busy: boolean;
  saving: boolean;
  error: string;
  category: Product["category"] | null;
  onCategory: (category: Product["category"] | null) => void;
  onMode: (mode: "discover" | "saved") => void;
  onSave: (productId: string) => void;
  onRetry: () => void;
  onBack: () => void;
  onRecord: (productId: string) => void;
  onReason: (productId: string) => void;
  onBegin: () => void;
};
/** 04 / 19:784 and 19:972. Error/empty states extend the captured design. */
export function DiscoveryScreen(props: Props) {
  const { result, wishlist, mode, busy, saving, error, category } = props;
  const [editingSaved, setEditingSaved] = useState(false);
  const saved = new Set(
    wishlist.filter((r) => r.saved).map((r) => r.productId),
  );
  // Use the latest durable wishlist result, not the older recommendation response.
  const recommendations = personalizedDrinks(result?.recommendations ?? [], saved);
  const rows = mode === "saved" ? products.filter((p) => saved.has(p.id)) : [];
  function explanation(row: NextDrink) {
    if (!row.similar.length)
      return row.cautions.length
        ? "아쉽게 남긴 느낌도 있어요. 차이를 살펴봐요."
        : "제품의 향과 맛부터 둘러봐요. 아직 내 취향인지는 몰라요.";
    return `${row.similar
      .slice(0, 2)
      .map((f) => f.label)
      .join(
        " · ",
      )}을 좋게 남긴 기록이 있어요.${row.cautions.length ? " 다르게 느낀 기록도 있어요." : ""}`;
  }
  return (
    <ScrollView
      contentContainerStyle={[s.content, mode === "saved" && s.savedContent]}
    >
      {mode === "saved" ? (
        <>
          <Button
            variant="text"
            label="‹  내 취향"
            onPress={props.onBack}
            style={s.back}
          />
          <View style={s.titleRow}>
            <Text style={[s.heading, s.flex]}>마셔보고 싶은 술</Text>
            <Button
              variant="text"
              label={editingSaved ? "완료" : "편집"}
              onPress={() => setEditingSaved(!editingSaved)}
              style={s.editLink}
            />
          </View>
          <Text style={s.body}>
            궁금했던 한 잔, 여기 모아뒀어요. {saved.size}
          </Text>
        </>
      ) : (
        <>
          <View style={s.titleRow}>
            <Text style={[s.heading, s.flex]}>다음 한 잔</Text>
            <Button
              variant="text"
              label={`저장한 술 ${saved.size}`}
              onPress={() => props.onMode("saved")}
              style={s.savedLink}
            />
          </View>
          <Text style={s.body}>
            {recommendations.length
              ? "좋게 남긴 느낌과 닮은 한 잔을 찾아봤어요."
              : "내가 남긴 느낌을 바탕으로 찾아드려요."}
          </Text>
          {recommendations.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filters}
            >
              {filters.map((value, i) => (
                <ChoiceChip
                  key={value ?? "all"}
                  outlined
                  label={value ? categoryLabels[value] : "전체"}
                  selected={category === value}
                  onPress={() => props.onCategory(value)}
                  style={{ minWidth: [48, 68, 56, 56, 72][i] }}
                />
              ))}
            </ScrollView>
          )}
        </>
      )}
      {busy ? (
        <ActivityIndicator
          accessibilityLabel="다음 한 잔 불러오는 중"
          color={colors.primary}
        />
      ) : null}
      {error ? (
        <View style={s.message}>
          <Text accessibilityRole="alert" style={s.notice}>
            {error}
          </Text>
          <Button
            variant="secondary"
            label="다시 시도"
            onPress={props.onRetry}
            loading={saving || busy}
          />
        </View>
      ) : null}
      {mode === "saved" ? (
        <>
          {rows.map((product) => (
            <View key={product.id} style={s.wishRow}>
              <DrinkArt category={product.category} size={64} />
              <View style={s.flex}>
                <Text style={s.label}>{product.name}</Text>
                <Text style={s.caption}>
                  {categoryLabels[product.category]} · {product.edition}
                </Text>
              </View>
              <Button
                variant="text"
                label={editingSaved ? "저장 해제" : "마셨어요"}
                disabled={editingSaved && (saving || busy || !!error)}
                onPress={() =>
                  editingSaved
                    ? props.onSave(product.id)
                    : props.onRecord(product.id)
                }
                style={s.recordLink}
              />
            </View>
          ))}
          {!busy && !error && !rows.length ? (
            <Text style={s.body}>궁금한 술의 북마크를 눌러 모아보세요.</Text>
          ) : null}
          <View style={s.tip}>
            <Text style={s.tipTitle}>마셨을 때, 내 느낌을 남겨요.</Text>
            <Text style={s.body}>
              사진만으로도 기록할 수 있어요.{"\n"}남긴 느낌은 다음 추천에
              반영돼요.
            </Text>
          </View>
          <Button
            variant="secondary"
            label="다른 술도 찾아보기"
            onPress={() => props.onMode("discover")}
          />
        </>
      ) : (
        <>
          {recommendations
            .filter((r) => !category || r.product.category === category)
            .map((row) => (
              <View key={row.product.id} style={s.drink}>
                <View style={s.identity}>
                  <DrinkArt category={row.product.category} />
                  <View style={s.details}>
                    <Text style={s.caption}>
                      {categoryLabels[row.product.category]} ·{" "}
                      {row.product.edition}
                    </Text>
                    <Text style={s.productName}>{row.product.name}</Text>
                    <Text style={s.caption}>
                      {row.kind === "close"
                        ? "가까운 취향"
                        : row.kind === "new-category"
                          ? "새 주종 탐색"
                          : "새로운 한 잔 탐색"}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${row.product.name} ${saved.has(row.product.id) ? "저장 해제" : "저장"}`}
                    accessibilityState={{
                      selected: saved.has(row.product.id),
                      disabled: saving || busy || !!error,
                    }}
                    disabled={saving || busy || !!error}
                    onPress={() => props.onSave(row.product.id)}
                    style={[
                      s.bookmark,
                      saved.has(row.product.id) && s.bookmarked,
                    ]}
                  >
                    <BookmarkArt />
                  </Pressable>
                </View>
                <View style={s.reasonRow}>
                  <Text style={[s.body, s.flex]}>{explanation(row)}</Text>
                  <Button
                    variant="text"
                    label="이유 보기  ›"
                    onPress={() => props.onReason(row.product.id)}
                    style={s.reasonLink}
                  />
                </View>
                <View style={s.divider} />
              </View>
            ))}
          {!busy && !error && result && !recommendations.length ? (
            <View style={s.empty}>
              <View style={s.mogu}>
                <Mogu />
              </View>
              <Text style={s.emptyTitle}>
                {!result.sensoryRecordCount
                  ? "한 잔의 느낌부터 남겨볼까요?"
                  : "새롭게 추천할 술이 아직 없어요."}
              </Text>
              <Text style={s.emptyCopy}>
                {!result.sensoryRecordCount
                  ? "어떤 향과 맛이 좋았는지 알려주면\n그 느낌과 닮은 술을 찾아드려요."
                  : "마신 술과 저장한 술은 제외하고 찾아요.\n좋게 남긴 느낌이 더 쌓이면 다시 비교해볼게요."}
              </Text>
              <Button
                label={
                  result.recordCount
                    ? "내 기록에 느낌 남기기"
                    : "첫 한 잔 남기기"
                }
                onPress={props.onBegin}
              />
            </View>
          ) : !busy &&
            !error &&
            result &&
            !recommendations.some(
              (r) => !category || r.product.category === category,
            ) ? (
            <View style={s.message}>
              <Text style={s.body}>
                이 주종에서는 아직 내 기록과 닮은 술을 찾지 못했어요.
              </Text>
              <Button
                label="전체 주종 보기"
                variant="text"
                onPress={() => props.onCategory(null)}
              />
            </View>
          ) : null}
          {result && recommendations.length ? (
            <Text style={s.caption}>
              출처를 확인한 제품 특징과 내 기록을 비교했어요.
              {result.omittedSensoryRecords
                ? " 감각 비교에는 최근 200개 기록을 사용했어요."
                : ""}
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  empty: { alignItems: "stretch", gap: space.lg, paddingVertical: space.xl },
  mogu: { width: 170, height: 153, alignSelf: "center" },
  emptyTitle: { ...typography.title, color: colors.text, textAlign: "center" },
  emptyCopy: { ...typography.body, color: colors.muted, textAlign: "center" },
  content: { padding: layout.screenPadding, gap: space.xl },
  savedContent: { gap: space.lg },
  flex: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  heading: { ...typography.question, color: colors.text },
  body: { ...typography.body, color: colors.muted },
  caption: { ...typography.caption, color: colors.muted },
  label: { ...typography.fieldLabel, color: colors.text },
  savedLink: {
    width: 128,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  back: {
    alignSelf: "flex-start",
    minWidth: 120,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  filters: { gap: space.sm, paddingVertical: 6 },
  drink: { gap: space.md },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  details: { flex: 1, gap: space.xs },
  productName: { ...typography.title, color: colors.text },
  bookmark: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  bookmarked: { backgroundColor: colors.selected },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  reasonLink: {
    width: 104,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  divider: { height: 1, backgroundColor: colors.border },
  wishRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 112,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  editLink: {
    width: 64,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  recordLink: {
    width: 88,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  tip: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.selected,
  },
  tipTitle: { ...typography.fieldLabel, color: colors.primary },
  message: { gap: space.md },
  notice: { ...typography.body, color: colors.primary },
});
