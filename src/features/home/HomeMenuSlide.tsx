import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";
import { colors, fonts, typography } from "../../theme/tokens";

export function HomeMenuSlide({ onOpen }: { onOpen: () => void }) {
  return (
    <View style={s.slide}>
      <Text style={s.eyebrow}>오늘의 메뉴, 나다운 선택</Text>
      <Text
        style={s.title}
        lineBreakStrategyIOS="hangul-word"
        textBreakStrategy="balanced"
      >
        이 중에서,{"\n"}내 취향은 뭘까?
      </Text>
      <View style={s.feature}>
        <View style={s.copy}>
          <Text style={s.lead}>여러 장도{"\n"}한 번에.</Text>
          <Text style={s.caption}>
            사진 속 메뉴를 읽고,{"\n"}내 기록과 비교해요.
          </Text>
        </View>
        <MenuArtwork />
      </View>
      <View style={s.rule} />
      <Text style={s.steps}>사진 모으기 → 메뉴 확인 → 취향 비교</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="메뉴판 사진 올리기"
        onPress={onOpen}
        style={s.action}
      >
        <Text style={s.actionText}>메뉴판 올리기</Text>
        <Text style={s.arrow}>↗</Text>
      </Pressable>
    </View>
  );
}
function MenuArtwork() {
  return (
    <Svg width={104} height={124} viewBox="0 0 120 144" accessible={false}>
      <G rotation={10} origin="61,73">
        <Rect
          x={29}
          y={12}
          width={81}
          height={117}
          rx={3}
          fill={colors.onPrimaryMuted}
          opacity={0.4}
        />
        <Rect
          x={23}
          y={7}
          width={81}
          height={117}
          rx={3}
          fill={colors.border}
        />
      </G>
      <G rotation={-8} origin="48,76">
        <Rect
          x={10}
          y={15}
          width={81}
          height={117}
          rx={3}
          fill={colors.background}
        />
        <SvgText
          x={20}
          y={34}
          fontSize={9}
          fontFamily={fonts.bold}
          fill={colors.primary}
        >
          01
        </SvgText>
        <SvgText
          x={44}
          y={34}
          fontSize={7}
          fontFamily={fonts.medium}
          fill={colors.primary}
        >
          MENU
        </SvgText>
        <Path
          d="M20 43H81M20 66H68M20 104H76M20 116H65"
          stroke={colors.border}
          strokeWidth={1.2}
        />
        <SvgText
          x={20}
          y={57}
          fontSize={6}
          fontFamily={fonts.regular}
          fill={colors.muted}
        >
          WHISKY
        </SvgText>
        <Rect
          x={16}
          y={76}
          width={69}
          height={17}
          rx={2}
          fill={colors.selected}
        />
        <Path
          d="M21 85H76"
          stroke={colors.primary}
          strokeOpacity={0.5}
          strokeWidth={1.2}
        />
      </G>
    </Svg>
  );
}
const s = StyleSheet.create({
  slide: { paddingHorizontal: 24, paddingVertical: 12, gap: 8 },
  eyebrow: { ...typography.caption, color: colors.onPrimaryMuted },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  feature: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 12 },
  lead: { ...typography.nav, color: colors.surface },
  caption: { ...typography.caption, color: colors.onPrimaryMuted },
  rule: { height: 1, backgroundColor: colors.onPrimaryMuted, opacity: 0.35 },
  steps: { ...typography.caption, color: colors.surface },
  action: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actionText: { ...typography.button, color: colors.surface },
  arrow: { fontSize: 24, color: colors.surface },
});
