/** Synthetic observations only. Not real customer notes or a model accuracy benchmark. */
export const menuQualityCases = [
  {
    category: "whisky",
    productId: "glenfiddich-12",
    light: "fruit",
    deep: "family.fruit",
  },
  {
    category: "wine",
    productId: "cloudy-bay-sb-2024",
    light: "citrus",
    deep: "family.fruit",
  },
  {
    category: "beer",
    productId: "sierra-nevada-pale-ale",
    light: "citrus",
    deep: "family.fruit",
  },
  {
    category: "traditional",
    productId: "hwayo-25",
    light: "rice_grain",
    deep: "family.rice_grain",
  },
] as const;
