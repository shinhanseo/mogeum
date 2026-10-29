import { Redirect } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeCarousel } from "../../src/features/home/HomeCarousel";
import { HomeTasteMetrics } from "../../src/features/home/HomeTasteMetrics";
import { colors, typography } from "../../src/theme/tokens";
import { useWindowDimensions } from "react-native";
import { snapshot } from "./home-metrics";
export default function CarouselHeightPreview() {
  const { width } = useWindowDimensions();
  if (!__DEV__) return <Redirect href="/" />;
  const title = { ...typography.question, color: colors.surface };
  const body = { ...typography.body, color: colors.surface };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <Text style={{ ...typography.caption, padding: 16 }}>
          개발용 합성 시안 · 페이지별 실제 높이 확인
        </Text>
        <View style={{ backgroundColor: colors.primary }}>
          <HomeCarousel
            width={width}
            labels={["다음 한 잔", "내 취향", "메뉴판"]}
          >
            <View style={{ padding: 24, gap: 12 }}>
              <Text style={title}>다음 한 잔</Text>
              <Text style={body}>짧은 추천 근거를 보여주는 페이지예요.</Text>
            </View>
            <View style={{ padding: 24, gap: 12 }}>
              <Text style={title}>내가 자주 남긴 감각</Text>
              <HomeTasteMetrics
                compact
                snapshot={snapshot}
                onEvidence={() => {}}
              />
            </View>
            <View style={{ padding: 24, gap: 12 }}>
              <Text style={title}>메뉴판에서 내 취향 찾기</Text>
              <Text style={body}>사진 여러 장을 모아 내 기록과 비교해요.</Text>
              <Text style={body}>읽은 메뉴를 확인한 뒤 선택해요.</Text>
            </View>
          </HomeCarousel>
        </View>
        <Text style={{ ...typography.title, padding: 24 }}>
          최근 테이스팅 노트
        </Text>
        <Text style={{ ...typography.caption, paddingHorizontal: 24 }}>
          위 페이지 아래에 불필요한 빈 공간이 없어야 해요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
