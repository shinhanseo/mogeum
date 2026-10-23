import type { Category, CellarItem } from "./model";
type Row = {
  id: string;
  user_id: string;
  display_name: string | null;
  category: string | null;
  record_count: number | string;
  photo_path: string | null;
};
type Ports = {
  page: (from: number, size: number) => Promise<Row[]>;
  photos: (paths: string[]) => Promise<Map<string, string>>;
  active: () => boolean;
};
const kinds: Record<string, Category> = {
  whisky: "위스키",
  wine: "와인",
  beer: "맥주",
  traditional: "전통주",
  other: "기타",
};
/** Keep the existing full local search while bounding signing requests. Cancel before starting any later batch. */
export async function loadCellar(
  owner: string,
  ports: Ports,
): Promise<CellarItem[] | null> {
  const rows = new Map<string, Row>();
  for (let from = 0; ; from += 100) {
    if (!ports.active()) return null;
    const page = await ports.page(from, 100);
    if (!ports.active()) return null;
    for (const row of page) if (row.user_id === owner) rows.set(row.id, row);
    if (page.length < 100) break;
  }
  const paths = [
    ...new Set(
      [...rows.values()].flatMap((row) =>
        row.photo_path ? [row.photo_path] : [],
      ),
    ),
  ];
  const urls = new Map<string, string>();
  for (let from = 0; from < paths.length; from += 100) {
    if (!ports.active()) return null;
    const batch = paths.slice(from, from + 100);
    try {
      const signed = await ports.photos(batch);
      if (!ports.active()) return null;
      for (const path of batch) {
        const url = signed.get(path);
        if (url) urls.set(path, url);
      }
    } catch {
      // A failed batch must not erase successful links or the cellar itself.
      if (!ports.active()) return null;
    }
  }
  return [...rows.values()].map((row) => ({
    id: row.id,
    name: row.display_name,
    category: kinds[row.category ?? ""] ?? null,
    recordCount: Number(row.record_count),
    photoUri: row.photo_path ? (urls.get(row.photo_path) ?? null) : null,
  }));
}
