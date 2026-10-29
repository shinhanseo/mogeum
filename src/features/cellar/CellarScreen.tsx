import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Button } from "../../components/Button";
import { CellarArt } from "../../components/CellarArt";
import { Icon } from "../../components/Icon";
import { colors, fonts, typography, layout } from "../../theme/tokens";
import { categories, shelfRows, type Category, type CellarItem } from "./model";

function CellarTile({
  item,
  onPress,
}: {
  item: CellarItem;
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const artSize = Math.min(88, (Math.min(width, 600) - 64) / 3);
  return (
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${item.name ?? "이름 없는 술"} 기록 보기`}
      onPress={onPress}
    >
      <View style={styles.art}>
        <CellarArt id={item.id} category={item.category} size={artSize} />
        {item.recordCount > 1 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.recordCount}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.name}>
        {item.name || "이름 없는 술"}
      </Text>
      <Text style={styles.category}>{item.category || "주종 미입력"}</Text>
    </Pressable>
  );
}
export function CellarScreen({
  items,
  totalCount,
  loading,
  error,
  onNext,
  onRetry,
  category,
  onCategory,
  query,
  onQuery,
  onRecord,
  onOpen,
}: {
  items: CellarItem[];
  totalCount: number;
  loading: boolean;
  error: boolean;
  onNext: () => void;
  onRetry: () => void;
  onPhotoError?: (id: string, uri: string) => void;
  category: Category | "전체";
  onCategory: (value: Category | "전체") => void;
  query: string;
  onQuery: (value: string) => void;
  onRecord: () => void;
  onOpen: (entryId: string) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const filtered = items;
  const empty = !items.length && totalCount === 0 && !loading && !error;
  const status = (
    <View style={styles.noResults}>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel="술장 불러오는 중"
          color={colors.primary}
        />
      ) : error ? (
        <>
          <Text accessibilityRole="alert" style={styles.emptyBody}>
            술장을 불러오지 못했어요.
          </Text>
          <Button label="다시 불러오기" variant="secondary" onPress={onRetry} />
        </>
      ) : null}
    </View>
  );
  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>나의 술장</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="술 찾기"
            onPress={() => setSearchOpen(!searchOpen)}
            style={styles.searchAction}
          >
            <Icon name="search" color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.count}>모아둔 술 {totalCount}</Text>
        {searchOpen && (
          <TextInput
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => Keyboard.dismiss()}
            maxLength={150}
            accessibilityLabel="술 이름 검색"
            placeholder="술 이름으로 찾기"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={onQuery}
            style={styles.search}
          />
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filters}
        >
          {(["전체", ...categories] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: category === value }}
              onPress={() => onCategory(value)}
              style={[styles.filter, category === value && styles.filterActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  category === value && styles.filterSelected,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {(loading || error) && !items.length ? (
        status
      ) : !empty && filtered.length === 0 ? (
        <View style={styles.noResults}>
          <Text style={styles.emptyTitle}>찾는 술이 없어요</Text>
          <Button
            label="검색 조건 지우기"
            variant="secondary"
            onPress={() => {
              onCategory("전체");
              onQuery("");
            }}
          />
        </View>
      ) : (
        <FlatList
          key={`${category}:${query}`}
          onEndReached={onNext}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            (loading || error) && items.length ? status : undefined
          }
          data={shelfRows(filtered)}
          keyExtractor={(_, index) => `shelf-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item: row, index }) => (
            <View style={styles.shelf}>
              <View style={styles.slots}>
                {row.map((item, column) => (
                  <View key={item?.id ?? `empty-${column}`} style={styles.slot}>
                    {item && (
                      <CellarTile item={item} onPress={() => onOpen(item.id)} />
                    )}
                  </View>
                ))}
              </View>
              {empty && index === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>
                    아직 비어 있어도 괜찮아.
                  </Text>
                  <Text style={styles.emptyBody}>
                    마신 한 잔의 사진부터 모아볼까요?
                  </Text>
                  <Button
                    label="첫 사진 남기기"
                    onPress={onRecord}
                    style={{ marginTop: 4, marginHorizontal: 20 }}
                  />
                </View>
              )}
              <View style={styles.shelfTop} />
              <View style={styles.shelfFront} />
            </View>
          )}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    minHeight: layout.cellarHeader,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 27,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchAction: {
    width: 36,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.heading, color: colors.text },
  count: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.muted,
  },
  filterScroll: { marginTop: 24, flexGrow: 0 },
  filters: { flexDirection: "row", gap: 6 },
  search: {
    minHeight: 44,
    backgroundColor: colors.cabinet.top,
    paddingHorizontal: 14,
    borderRadius: 12,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  shelf: { minHeight: 202, backgroundColor: colors.cabinet.back },
  slots: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 190,
  },
  slot: { flex: 1, minWidth: 0 },
  art: { alignItems: "center", position: "relative" },
  badge: {
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: colors.background,
    borderRadius: 12,
    minWidth: 22,
    padding: 3,
    alignItems: "center",
  },
  badgeText: { ...typography.caption, color: colors.primary },
  filter: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterActive: { borderBottomColor: colors.primary },
  filterText: { ...typography.caption, color: colors.muted },
  filterSelected: { color: colors.primary, fontFamily: fonts.bold },
  card: { alignItems: "center", gap: 6 },
  photo: { width: "100%", aspectRatio: 3 / 4 },
  cutoutCard: { backgroundColor: "transparent" },
  fallback: {
    backgroundColor: colors.cabinet.top,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  name: {
    fontSize: 11,
    lineHeight: 17,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: "center",
    minHeight: 34,
  },
  category: {
    fontSize: 10,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: "center",
  },
  shelfTop: { height: 3, backgroundColor: colors.cabinet.top },
  shelfFront: {
    height: 6,
    backgroundColor: colors.cabinet.front,
    borderBottomWidth: 2,
    borderBottomColor: colors.cabinet.shadow,
  },
  empty: { position: "absolute", top: 36, left: 14, right: 14, gap: 12 },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 24,
    color: colors.muted,
    fontFamily: fonts.regular,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    fontFamily: fonts.regular,
    textAlign: "center",
  },
  noResults: { padding: 24, gap: 20 },
});
