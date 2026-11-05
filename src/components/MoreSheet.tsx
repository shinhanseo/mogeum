import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BartenderOtter } from "../features/bartender/BartenderOtter";
import { colors, space, radius, typography } from "../theme/tokens";
import { Icon } from "./Icon";
export function MoreSheet({
  visible,
  onClose,
  onBartender,
  onAccount,
}: {
  visible: boolean;
  onClose: () => void;
  onBartender: () => void;
  onAccount: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="더보기 닫기"
          style={s.scrim}
          onPress={onClose}
        />
        <View
          style={[
            s.sheet,
            { paddingBottom: Math.max(insets.bottom, space.xl) },
          ]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>더보기</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              style={s.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="모금 바텐더와 이야기하기"
              style={s.bartender}
              onPress={onBartender}
            >
              <BartenderOtter size={64} />
              <View style={s.copy}>
                <Text style={s.name}>모금 바텐더</Text>
                <Text style={s.caption}>
                  오늘 이야기도, 취향에 맞는 한 잔도.
                </Text>
              </View>
              <Text style={s.arrow}>›</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="설정 및 계정 관리"
              style={s.row}
              onPress={onAccount}
            >
              <Icon name="settings" color={colors.text} />
              <Text style={[s.body, s.copy]}>설정 및 계정 관리</Text>
              <Text style={s.arrow}>›</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: space.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  title: { ...typography.sheetTitle, color: colors.text },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: space.xl, gap: space.md },
  bartender: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  copy: { flex: 1 },
  name: { ...typography.nav, color: colors.primary },
  caption: { ...typography.caption, color: colors.muted, marginTop: space.xs },
  body: { ...typography.body, color: colors.text },
  arrow: { ...typography.title, color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
  },
});
