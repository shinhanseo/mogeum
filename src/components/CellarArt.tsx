import { View } from "react-native";
import { BundledSvg } from "./BundledSvg";
import { Icon } from "./Icon";
const assets = {
  whisky: [
    require("../../assets/cellar/whisky-1.svg"),
    require("../../assets/cellar/whisky-2.svg"),
    require("../../assets/cellar/whisky-3.svg"),
    require("../../assets/cellar/whisky-4.svg"),
  ],
  wine: [
    require("../../assets/cellar/wine-1.svg"),
    require("../../assets/cellar/wine-2.svg"),
    require("../../assets/cellar/wine-3.svg"),
    require("../../assets/cellar/wine-4.svg"),
  ],
  beer: [
    require("../../assets/cellar/beer-1.svg"),
    require("../../assets/cellar/beer-2.svg"),
    require("../../assets/cellar/beer-3.svg"),
    require("../../assets/cellar/beer-4.svg"),
  ],
  traditional: [
    require("../../assets/cellar/traditional-1.svg"),
    require("../../assets/cellar/traditional-2.svg"),
    require("../../assets/cellar/traditional-3.svg"),
    require("../../assets/cellar/traditional-4.svg"),
  ],
};
export function artVariant(id: string) {
  let hash = 0;
  for (const ch of id) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) | 0;
  return (hash >>> 0) % 4;
}
export function artCategory(category: string | null) {
  return (
    (
      {
        위스키: "whisky",
        와인: "wine",
        맥주: "beer",
        전통주: "traditional",
      } as Record<string, string>
    )[category ?? ""] ?? category
  );
}
export function CellarArt({
  id,
  category,
  size = 88,
}: {
  id: string;
  category: string | null;
  size?: number;
}) {
  const key = artCategory(category);
  const variants = assets[key as keyof typeof assets];
  return (
    <View accessible={false} style={{ width: size, height: size }}>
      {variants ? (
        <View
          style={{
            width: 120,
            height: 120,
            transform: [
              { translateX: (size - 120) / 2 },
              { translateY: (size - 120) / 2 },
              { scale: size / 120 },
            ],
          }}
        >
          <BundledSvg module={variants[artVariant(id)]} />
        </View>
      ) : (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="photo" size={size / 3} />
        </View>
      )}
    </View>
  );
}
