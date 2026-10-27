import { StyleSheet, View } from "react-native";
import { BundledSvg } from "../../components/BundledSvg";
import type { Product } from "../../../supabase/functions/_shared/product-catalog";
const assets = {
  whisky: require("../../../assets/discovery/whisky.svg"),
  beer: require("../../../assets/discovery/beer.svg"),
  wine: require("../../../assets/discovery/wine.svg"),
  traditional: require("../../../assets/discovery/traditional.svg"),
};
const bookmark = require("../../../assets/discovery/bookmark.svg");
/** Original 19:784 assets keep their 88px SVG roots; the 64px list slot scales the wrapper. */
export function DrinkArt({
  category,
  size = 88,
}: {
  category: Product["category"];
  size?: 88 | 64;
}) {
  return (
    <View accessible={false} style={{ width: size, height: size }}>
      <View style={[styles.original, size === 64 && styles.small]}>
        <BundledSvg module={assets[category]} />
      </View>
    </View>
  );
}
export function BookmarkArt() {
  return <BundledSvg module={bookmark} />;
}
const styles = StyleSheet.create({
  original: { width: 88, height: 88 },
  small: {
    transform: [{ translateX: -12 }, { translateY: -12 }, { scale: 64 / 88 }],
  },
});
