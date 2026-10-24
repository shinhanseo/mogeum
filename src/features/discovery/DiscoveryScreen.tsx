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
};
/** 04 / 19:784 and 19:972. Error/empty states extend the captured design. */
export function DiscoveryScreen(props: Props) {
  const { result, wishlist, mode, busy, saving, error, category } = props;
  const [editingSaved, setEditingSaved] = useState(false);
  const saved = new Set(
    wishlist.filter((r) => r.saved).map((r) => r.productId),
  );
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
          <Text style={s.body}>가까운 취향부터, 조금 새로운 한 잔까지.</Text>
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
          {result?.recommendations
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
          {!busy &&
          !error &&
          result &&
          !result.recommendations.filter(
            (r) => !category || r.product.category === category,
          ).length ? (
            <Text style={s.body}>
              준비한 제품을 모두 만나봤어요. 다른 주종도 둘러보세요.
            </Text>
          ) : null}
          {result ? (
            <Text style={s.caption}>
              출처를 확인한 {result.catalogSize}개 제품 안에서 비교해요. 실제
              모델 생성이 아닌 내 기록과 제품 특징 비교예요.
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
