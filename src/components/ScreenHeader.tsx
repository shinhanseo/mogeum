import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, typography } from "../theme/tokens";
export function WebStatusSpace() {
  return Platform.OS === "web" ? <View style={{ height: 32 }} /> : null;
}
export function ScreenHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={onBack}
          style={styles.action}
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.action} />
      )}
      <Text style={styles.title}>{title}</Text>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.action}
        >
          <Text style={styles.close}>닫기</Text>
        </Pressable>
      ) : (
        <View style={styles.action} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    height: 60,
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  action: { minHeight: 44, minWidth: 32, justifyContent: "center" },
  title: {
    ...typography.nav,
    color: colors.text,
    position: "absolute",
    top: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    pointerEvents: "none",
  },
  back: {
    fontSize: 30,
    lineHeight: 40,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  close: { ...typography.caption, color: colors.muted, textAlign: "right" },
});
