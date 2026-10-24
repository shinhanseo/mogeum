import type { SupabaseClient } from "@supabase/supabase-js";
import { signPhotoBatch } from "../records/photo-links";
import type { CellarItem, Category } from "./model";
export type CellarFilter = { query: string; category: Category | "전체" };
export type CellarCursor = { date: string | null; id: string };
export type CellarPage = {
  items: CellarItem[];
  next: CellarCursor | null;
  total: number | null;
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const categories: Record<string, string> = {
  위스키: "whisky",
  와인: "wine",
  맥주: "beer",
  전통주: "traditional",
  기타: "other",
};
const labels: Record<string, Category> = {
  whisky: "위스키",
  wine: "와인",
  beer: "맥주",
  traditional: "전통주",
  other: "기타",
};
export function createCellarRepository(client: SupabaseClient, owner: string) {
  if (!uuid.test(owner)) throw new Error("INVALID_OWNER");
  return {
    async refreshPhoto(
      id: string,
      active: () => boolean,
    ): Promise<string | null> {
      if (!uuid.test(id)) throw new Error("INVALID_CELLAR_ENTRY");
      if (!active()) return null;
      const { data, error } = await client
        .from("cellar_overview")
        .select("id,user_id,photo_path")
        .eq("user_id", owner)
        .eq("id", id)
        .abortSignal(AbortSignal.timeout(20000))
        .maybeSingle();
      if (error) throw new Error("CELLAR_PHOTO_UNAVAILABLE");
      const path = data?.photo_path;
      if (
        !active() ||
        !data ||
        data.user_id !== owner ||
        typeof path !== "string" ||
        !path.startsWith(`${owner}/records/`) ||
        path.split("/").some((part) => part === ".." || part === ".")
      )
        return null;
      const urls = await signPhotoBatch(client, [path]);
      return active() ? (urls.get(path) ?? null) : null;
    },
    async page(
      filter: CellarFilter,
      cursor: CellarCursor | null,
      active: () => boolean,
    ): Promise<CellarPage> {
      if (
        filter.query.length > 150 ||
        !(filter.category === "전체" || categories[filter.category])
      )
        throw new Error("INVALID_FILTER");
      if (
        cursor &&
        (!uuid.test(cursor.id) ||
          (cursor.date !== null &&
            (!date.test(cursor.date) ||
              !Number.isFinite(Date.parse(cursor.date)))))
      )
        throw new Error("INVALID_CURSOR");
      let query = client
        .from("cellar_overview")
        .select("*")
        .eq("user_id", owner)
        .order("last_consumed_at", { ascending: false, nullsFirst: false })
        .order("id")
        .limit(31);
      if (filter.category !== "전체")
        query = query.eq("category", categories[filter.category]);
      const search = filter.query.trim();
      if (search)
        query = query.ilike(
          "display_name",
          `%${search.replace(/[\\%_]/g, "\\$&")}%`,
        );
      if (cursor) {
        query =
          cursor.date === null
            ? query.is("last_consumed_at", null).gt("id", cursor.id)
            : query.or(
                `last_consumed_at.lt.${cursor.date},and(last_consumed_at.eq.${cursor.date},id.gt.${cursor.id}),last_consumed_at.is.null`,
              );
      }
      const [{ data, error }, count] = await Promise.all([
        query.abortSignal(AbortSignal.timeout(20000)),
        cursor
          ? Promise.resolve(null)
          : client
              .from("cellar_overview")
              .select("id", { count: "exact", head: true })
              .eq("user_id", owner)
              .abortSignal(AbortSignal.timeout(20000)),
      ]);
      if (error || count?.error) throw new Error("CELLAR_UNAVAILABLE");
      if (
        !cursor &&
        (!Number.isSafeInteger(count?.count) || (count?.count ?? -1) < 0)
      )
        throw new Error("INVALID_CELLAR_TOTAL");
      if (!active()) throw new Error("CELLAR_CANCELED");
      if (
        !Array.isArray(data) ||
        data.some((row) => row.user_id !== owner || !uuid.test(row.id))
      )
        throw new Error("INVALID_CELLAR_PAGE");
      const rows = data.slice(0, 30);
      const paths = [
        ...new Set(
          rows.flatMap((row) =>
            typeof row.photo_path === "string" &&
            row.photo_path.startsWith(`${owner}/records/`)
              ? [row.photo_path]
              : [],
          ),
        ),
      ];
      let urls = new Map<string, string>();
      try {
        urls = await signPhotoBatch(client, paths);
      } catch {
        /* Preserve records if photo links fail. */
      }
      if (!active()) throw new Error("CELLAR_CANCELED");
      const last = rows.at(-1);
      const next =
        data.length > 30 && last
          ? {
              date: last.last_consumed_at as string | null,
              id: last.id as string,
            }
          : null;
      if (
        next &&
        next.date !== null &&
        (!date.test(next.date) || !Number.isFinite(Date.parse(next.date)))
      )
        throw new Error("INVALID_CELLAR_CURSOR");
      return {
        items: rows.map((row) => ({
          id: row.id,
          name: row.display_name,
          category: labels[row.category] ?? null,
          recordCount: Number(row.record_count),
          photoUri: urls.get(row.photo_path) ?? null,
        })),
        next,
        total: count?.count ?? null,
      };
    },
  };
}
