import { products } from "../../../supabase/functions/_shared/product-catalog";
export function discoveryPrefill(productId: string | undefined) {
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  const categories = {
    whisky: "위스키",
    beer: "맥주",
    wine: "와인",
    traditional: "전통주",
  } as const;
  const year =
    product.category === "wine"
      ? product.edition.match(/(?:19|20)\d{2}/)?.[0]
      : undefined;
  return {
    name: product.name,
    category: categories[product.category],
    vintageYear: year ?? "",
    vintageMode: year
      ? ("year" as const)
      : product.category === "wine" && /NV/i.test(product.edition)
        ? ("NV" as const)
        : ("unknown" as const),
  };
}
