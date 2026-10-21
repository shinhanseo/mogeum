export const categories = ['위스키', '와인', '맥주', '전통주'] as const;
export type Category = typeof categories[number];
export type CellarItem = { id: string; name: string | null; category: Category | null; photoUri: string | null; recordCount: number };
export function shelfRows<T>(items: readonly T[]): (T | null)[][] {
  const result: (T | null)[][] = [];
  for (let offset = 0; offset < items.length; offset += 3) result.push(Array.from({ length: 3 }, (_, index) => items[offset + index] ?? null));
  while (result.length < 2) result.push([null, null, null]);
  return result;
}
