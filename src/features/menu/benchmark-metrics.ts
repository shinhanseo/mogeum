import type {
  MenuItem,
  MenuPhoto,
} from "../../../supabase/functions/_shared/menu-domain";
export type BenchmarkExpected = {
  name: string;
  price?: number | null;
  serving?: string | null;
};
export type BenchmarkCase = {
  id: string;
  label: string;
  expected: BenchmarkExpected[];
  parseable: boolean;
};
const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
/** Synthetic name coverage, not character-error-rate or real restaurant accuracy. Duplicate entries consume distinct matches. */
export function benchmarkMetrics(
  fixture: BenchmarkCase,
  photo: MenuPhoto,
  items: MenuItem[],
) {
  const raw = norm(photo.lines.map((l) => l.text).join(" "));
  const counts = new Map<string, number>();
  for (const e of fixture.expected) {
    const name = norm(e.name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let namesObserved = 0;
  for (const [name, count] of counts) {
    let offset = 0,
      found = 0;
    while (name && found < count) {
      const at = raw.indexOf(name, offset);
      if (at < 0) break;
      found++;
      offset = at + name.length;
    }
    namesObserved += found;
  }
  const remaining = [...items];
  let matchedNames = 0,
    correctPrices = 0,
    correctServings = 0;
  for (const expected of fixture.expected) {
    const index = remaining.findIndex(
      (i) => norm(i.name) === norm(expected.name),
    );
    if (index < 0) continue;
    const [item] = remaining.splice(index, 1);
    matchedNames++;
    if (expected.price != null && item.price === expected.price)
      correctPrices++;
    if (
      expected.serving &&
      item.serving &&
      norm(item.serving) === norm(expected.serving)
    )
      correctServings++;
  }
  return {
    expectedEntries: fixture.expected.length,
    namesObserved,
    parsedEntries: items.length,
    matchedNames,
    correctPrices,
    correctServings,
    unmatchedParsedItems: remaining.length,
    abstentionViolations: fixture.parseable
      ? 0
      : items.filter((i) => i.price !== null).length,
  };
}
