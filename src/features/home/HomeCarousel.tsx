import {
  Children,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, typography } from "../../theme/tokens";

/** Full-width pages: never expose a neighboring page at rest. */
export function HomeCarousel({
  width,
  labels,
  children,
}: {
  width: number;
  labels: string[];
  children: ReactNode;
}) {
  const [heights, setHeights] = useState<Record<number, number>>({});
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [offset] = useState(() => new Animated.Value(0));
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return (
    <>
      <Animated.ScrollView
        ref={pager}
        style={
          heights[index] ? { height: heights[index], flexGrow: 0 } : undefined
        }
        contentContainerStyle={{ alignItems: "flex-start" }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: offset } } }],
          { useNativeDriver: true },
        )}
        onMomentumScrollEnd={(event) =>
          setIndex(
            Math.max(
              0,
              Math.min(
                labels.length - 1,
                Math.round(event.nativeEvent.contentOffset.x / width),
              ),
            ),
          )
        }
      >
        {Children.map(children, (child, i) => (
          <View
            key={labels[i]}
            style={{ width, alignSelf: "flex-start" }}
            onLayout={(event) => {
              const height = Math.ceil(event.nativeEvent.layout.height);
              if (height > 0)
                setHeights((previous) =>
                  previous[i] === height
                    ? previous
                    : { ...previous, [i]: height },
                );
            }}
          >
            {child}
          </View>
        ))}
      </Animated.ScrollView>
      <View style={s.controls}>
        <Text
          style={s.caption}
          accessibilityLabel={`${labels.length}개 중 ${index + 1}번째 화면`}
        >
          {index + 1} / {labels.length}
        </Text>
        <View style={s.dots}>
          {labels.map((label, i) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}/${labels.length} · ${label.replaceAll("\n", " ")}`}
              accessibilityState={{ selected: index === i }}
              style={s.target}
              onPress={() => {
                pager.current?.scrollTo({
                  x: width * i,
                  animated: !reduceMotion,
                });
                setIndex(i);
              }}
            >
              <Animated.View
                style={[
                  s.dot,
                  {
                    opacity: reduceMotion
                      ? index === i
                        ? 1
                        : 0.3
                      : offset.interpolate({
                          inputRange: [
                            (i - 1) * width,
                            i * width,
                            (i + 1) * width,
                          ],
                          outputRange: [0.3, 1, 0.3],
                          extrapolate: "clamp",
                        }),
                    transform: [
                      {
                        scaleX: reduceMotion
                          ? index === i
                            ? 2.5
                            : 1
                          : offset.interpolate({
                              inputRange: [
                                (i - 1) * width,
                                (i - 0.5) * width,
                                i * width,
                                (i + 0.5) * width,
                                (i + 1) * width,
                              ],
                              outputRange: [1, 3.2, 2.5, 3.2, 1],
                              extrapolate: "clamp",
                            }),
                      },
                    ],
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <Text style={[s.caption, s.hint]}>
          {index === labels.length - 1 ? "이전 이야기 ←" : "다음 이야기 →"}
        </Text>
      </View>
    </>
  );
}
const s = StyleSheet.create({
  controls: {
    backgroundColor: colors.background,
    minHeight: 48,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  target: {
    width: 32,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  caption: { ...typography.caption, color: colors.muted },
  hint: { textAlign: "right" },
});
