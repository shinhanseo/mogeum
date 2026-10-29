import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../theme/tokens";
import { Icon } from "./Icon";
export type MainTab = "home" | "cellar" | "taste";
export function BottomTabBar({
  selected,
  onSelect,
  onRecord,
  onAccount,
}: {
  selected: MainTab;
  onSelect: (tab: MainTab) => void;
  onRecord: () => void;
  onAccount?: () => void;
}) {
  const inset = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(inset.bottom, 8) }]}>
      <View style={styles.row}>
        {(["home", "cellar", "record", "taste", "account"] as const).map(
          (tab) =>
            tab === "record" ? (
              <View key={tab} style={styles.column}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="한 잔 기록하기"
                  onPress={onRecord}
                  style={({ pressed }) => [
                    styles.record,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Icon name="plus" size={22} color={colors.surface} />
                </Pressable>
              </View>
            ) : tab === "account" ? (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityLabel="계정 관리"
                onPress={onAccount}
                style={styles.tab}
              >
                <Text allowFontScaling={false} style={styles.more}>
                  ···
                </Text>
                <Text
                  maxFontSizeMultiplier={1.4}
                  numberOfLines={1}
                  style={styles.label}
                >
                  더보기
                </Text>
              </Pressable>
            ) : (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: selected === tab }}
                onPress={() => onSelect(tab)}
                style={styles.tab}
              >
                <Icon
                  name={
                    tab === "home"
                      ? "home"
                      : tab === "cellar"
                        ? "shelf"
                        : "taste"
                  }
                  size={28}
                  color={selected === tab ? colors.primary : colors.muted}
                />
                <Text
                  maxFontSizeMultiplier={1.4}
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      color: selected === tab ? colors.primary : colors.muted,
                      fontFamily: selected === tab ? fonts.bold : fonts.regular,
                    },
                  ]}
                >
                  {tab === "home"
                    ? "홈"
                    : tab === "cellar"
                      ? "술장"
                      : "내 취향"}
                </Text>
              </Pressable>
            ),
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  column: {
    flex: 1,
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  tab: {
    flex: 1,
    minHeight: 68,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  more: {
    fontSize: 28,
    lineHeight: 28,
    color: colors.muted,
    textAlign: "center",
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
  record: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
