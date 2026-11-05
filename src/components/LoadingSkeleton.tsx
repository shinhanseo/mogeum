import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  View,
  type DimensionValue,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, space } from "../theme/tokens";
type Kind =
  | "count"
  | "home"
  | "hero"
  | "recent"
  | "cellar"
  | "taste"
  | "detail"
  | "form"
  | "evidence"
  | "recommendations"
  | "menu"
  | "chat"
  | "settings"
  | "question";
function Block({
  width = "100%",
  height = 16,
  round = 8,
  dark = false,
}: {
  width?: DimensionValue;
  height?: number;
  round?: number;
  dark?: boolean;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: round,
        backgroundColor: dark ? colors.onPrimaryMuted : colors.border,
      }}
    />
  );
}
function Lines({ dark = false }: { dark?: boolean }) {
  return (
    <View style={s.lines}>
      <Block width="88%" dark={dark} />
      <Block width="65%" dark={dark} />
    </View>
  );
}
function Row() {
  return (
    <View style={s.row}>
      <Block width={64} height={72} round={radius.sm} />
      <View style={s.copy}>
        <Block width="48%" height={12} />
        <Block width="85%" height={20} />
        <Block width="65%" height={12} />
      </View>
    </View>
  );
}
/** One cancellable pulse per layout. Reduced-motion users see a static placeholder. */
function Pulse({ children, label }: { children: ReactNode; label: string }) {
  const [opacity] = useState(() => new Animated.Value(0.65));
  useEffect(() => {
    let active = true;
    let loop: Animated.CompositeAnimation | undefined;
    const update = (reduce: boolean) => {
      loop?.stop();
      opacity.setValue(0.65);
      if (reduce || !active) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.65,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (active) update(v);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      update,
    );
    return () => {
      active = false;
      loop?.stop();
      opacity.stopAnimation();
      subscription.remove();
    };
  }, [opacity]);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        pointerEvents="none"
        style={{ opacity }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
export function LoadingSkeleton({
  kind,
  label = "화면 불러오는 중",
}: {
  kind: Kind;
  label?: string;
}) {
  let body: ReactNode;
  switch (kind) {
    case "count":
      body = <Block width={100} height={14} />;
      break;
    case "hero":
      body = (
        <View style={s.hero}>
          <Block width="45%" height={12} dark />
          <View style={s.row}>
            <View style={s.copy}>
              <Block width="92%" height={28} dark />
              <Block width="65%" height={24} dark />
            </View>
            <Block width={76} height={76} round={radius.lg} dark />
          </View>
          <Block height={1} dark />
          <Lines dark />
          <Block width="48%" height={18} dark />
        </View>
      );
      break;
    case "home":
      return (
        <>
          <View style={s.homeHero}>
            <View style={{ paddingHorizontal: space.xl }}>
              <Pulse label="홈 준비 중">
                <Block width={54} height={22} dark />
              </Pulse>
            </View>
            <LoadingSkeleton kind="hero" label={label} />
          </View>
          <View style={s.panel}>
            <LoadingSkeleton kind="recent" label="최근 기록 불러오는 중" />
          </View>
        </>
      );
    case "recent":
    case "evidence":
    case "recommendations":
      body = (
        <View style={s.group}>
          {[0, 1, 2].map((i) => (
            <Row key={i} />
          ))}
        </View>
      );
      break;
    case "cellar":
      body = (
        <View style={s.shelves}>
          {[0, 1].map((row) => (
            <View key={row}>
              <View style={s.shelf}>
                {[0, 1, 2].map((i) => (
                  <View style={s.bottle} key={i}>
                    <Block width={38} height={80} round={12} />
                    <Block width="85%" height={12} />
                    <Block width="55%" height={10} />
                  </View>
                ))}
              </View>
              <View style={s.wood} />
            </View>
          ))}
        </View>
      );
      break;
    case "taste":
      body = (
        <View style={s.group}>
          <Block width="40%" height={28} />
          <View style={s.row}>
            <Block width="45%" height={85} />
            <Block width="45%" height={85} />
          </View>
          <Block width="58%" height={24} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.lines}>
              <Block width="35%" height={12} />
              <Block height={8} round={4} />
            </View>
          ))}
          <Row />
        </View>
      );
      break;
    case "detail":
      body = (
        <View style={s.group}>
          <View style={s.portrait}>
            <Block height={280} round={radius.md} />
          </View>
          <Block width="25%" height={24} />
          <Block width="75%" height={28} />
          <Block width="45%" height={12} />
          <View style={s.surface}>
            <Lines />
            <Lines />
          </View>
        </View>
      );
      break;
    case "form":
      body = (
        <View style={s.group}>
          <View style={s.row}>
            <Block width={84} height={112} />
            <View style={s.copy}>
              <Block width="35%" />
              <Block width="85%" height={24} />
            </View>
          </View>
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.lines}>
              <Block width="25%" height={12} />
              <Block height={52} round={radius.md} />
            </View>
          ))}
          <Block height={52} round={radius.md} />
        </View>
      );
      break;
    case "question":
      body = (
        <View style={s.group}>
          <Block width="50%" height={12} />
          <Block height={4} />
          <Block width="80%" height={28} />
          <Lines />
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.row}>
              <Block width="48%" height={55} round={radius.md} />
              <Block width="48%" height={55} round={radius.md} />
            </View>
          ))}
        </View>
      );
      break;
    case "menu":
      body = (
        <View style={s.group}>
          <Block width="70%" height={26} />
          <Lines />
          <View style={s.row}>
            <Block width="46%" height={160} />
            <Block width="46%" height={160} />
          </View>
          <Row />
          <Row />
        </View>
      );
      break;
    case "chat":
      body = (
        <View style={s.group}>
          <View style={s.row}>
            <Block width={40} height={40} round={20} />
            <Block width="42%" />
          </View>
          <Lines />
          <Block width="85%" height={64} round={radius.md} />
        </View>
      );
      break;
    case "settings":
      body = (
        <View style={s.group}>
          <Block width="20%" height={14} />
          <Row />
          <Block width="25%" height={14} />
          <Row />
        </View>
      );
      break;
  }
  return <Pulse label={label}>{body}</Pulse>;
}
export function ScreenSkeleton({
  kind,
  label,
  inset = true,
}: {
  kind: Kind;
  label?: string;
  inset?: boolean;
}) {
  return (
    <SafeAreaView
      edges={inset ? ["top", "left", "right"] : []}
      style={[s.page, kind === "home" && { backgroundColor: colors.primary }]}
    >
      <ScrollView
        style={s.page}
        contentContainerStyle={kind === "home" ? undefined : s.panel}
        showsVerticalScrollIndicator={false}
      >
        {kind !== "home" && (
          <View style={s.header}>
            <Block width="35%" height={20} />
          </View>
        )}
        <LoadingSkeleton kind={kind} label={label} />
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { height: 60, paddingHorizontal: space.xl, justifyContent: "center" },
  panel: { padding: space.xl, gap: space.xl },
  group: { gap: space.xl },
  lines: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg },
  copy: { flex: 1, gap: space.md },
  hero: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    gap: space.lg,
    minHeight: 240,
  },
  homeHero: {
    backgroundColor: colors.primary,
    paddingTop: space.lg,
    gap: space.md,
  },
  surface: {
    backgroundColor: colors.surface,
    padding: space.lg,
    borderRadius: radius.md,
    gap: space.lg,
  },
  portrait: { width: "100%", maxWidth: 260, alignSelf: "center" },
  shelves: {
    backgroundColor: colors.cabinet.back,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderColor: colors.cabinet.side,
  },
  shelf: {
    flexDirection: "row",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: 40,
    paddingBottom: space.md,
    minHeight: 190,
  },
  bottle: { flex: 1, alignItems: "center", gap: space.sm },
  wood: {
    height: 9,
    backgroundColor: colors.cabinet.front,
    borderBottomWidth: 2,
    borderBottomColor: colors.cabinet.shadow,
  },
});
