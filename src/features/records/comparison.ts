import { aromaCatalogs, type TastingCategory } from "../tasting/catalog";
import { aromaLabels } from "../tasting/answers";
import { featureCatalog } from "../../../supabase/functions/_shared/taste-features";
import type { RecordDetail } from "./detail";
export type ComparisonAnswer = {
  mode: string;
  catalog_version: number;
  question_id: string;
  status: string;
  descriptor_codes: string[];
};
export type ComparableRecord = Pick<
  RecordDetail,
  | "id"
  | "cellar_entry_id"
  | "category"
  | "consumed_at"
  | "revisit"
  | "vintage_status"
  | "vintage_year"
  | "record_notes"
> & { record_answers?: ComparisonAnswer[] };
export type RecordComparison = {
  previousId: string;
  previousDate: string;
  changes: { label: string; before: string; after: string }[];
  unchanged: number;
  limited: boolean;
  revisit: { before: string; after: string } | null;
};
const feelings = {
  again: "또 마시고 싶어요",
  okay: "괜찮아요",
  not_for_me: "내 취향이 아니에요",
};
type Field = {
  id: string;
  label?: string;
  kind?: string;
  options?: readonly { code: string; label: string }[];
  when?: { field: string; includes: string };
  unless?: { field: string; includes: string };
};
const catalog = featureCatalog as unknown as Record<
  string,
  Record<string, Field[]>
>;
/** Compare explicit observations only. Missing answers never mean a sensation disappeared. */
export function compareRecords(
  current: ComparableRecord,
  previous: ComparableRecord,
): RecordComparison | null {
  if (
    current.id === previous.id ||
    current.cellar_entry_id !== previous.cellar_entry_id ||
    current.category !== previous.category
  )
    return null;
  const result: RecordComparison = {
    previousId: previous.id,
    previousDate: previous.consumed_at,
    changes: [],
    unchanged: 0,
    limited: false,
    revisit:
      current.revisit && previous.revisit
        ? {
            before: feelings[previous.revisit],
            after: feelings[current.revisit],
          }
        : null,
  };
  const a = current.record_notes,
    b = previous.record_notes;
  const usable = (n: typeof a) =>
    !!n?.confirmed_note &&
    n.catalog_version === 2 &&
    n.input_revision != null &&
    n.input_revision === n.confirmed_input_revision;
  const sameVintage =
    current.category !== "wine" ||
    (current.vintage_status === previous.vintage_status &&
      current.vintage_year === previous.vintage_year);
  if (!usable(a) || !usable(b) || a!.mode !== b!.mode || !sameVintage) {
    result.limited = true;
    return result;
  }
  const fields = catalog[current.category ?? ""]?.[a!.mode] ?? [];
  const values = (r: ComparableRecord) =>
    new Map(
      (r.record_answers ?? [])
        .filter(
          (x) => x.mode === r.record_notes?.mode && x.catalog_version === 2,
        )
        .map((x) => [x.question_id, x]),
    );
  const ca = values(current),
    pa = values(previous);
  function value(
    f: Field,
    answers: Map<string, ComparisonAnswer>,
    details: boolean,
  ) {
    const answer = answers.get(f.id);
    if (answer?.status !== "answered") return null;
    const chosen = (id: string, code: string) =>
      answers.get(id)?.status === "answered" &&
      answers.get(id)!.descriptor_codes.includes(code);
    if (
      (f.when && !chosen(f.when.field, f.when.includes)) ||
      (f.unless && chosen(f.unless.field, f.unless.includes))
    )
      return null;
    if (f.kind === "aroma" && details) {
      const families = aromaCatalogs[
        current.category as TastingCategory
      ] as Readonly<Record<string, readonly string[]>>;
      const labels = (f.options ?? [])
        .filter(
          (o) =>
            answer.descriptor_codes.includes(o.code) &&
            o.code.startsWith("family."),
        )
        .flatMap((o) => {
          const family = o.code.slice(7);
          const selected = (families?.[family] ?? []).filter((code) =>
            answer.descriptor_codes.includes(`detail.${family}.${code}`),
          );
          return selected.length
            ? selected.map((code) => aromaLabels[code] ?? o.label)
            : [o.label];
        });
      return labels.length ? labels.join(" · ") : null;
    }
    const labels = (f.options ?? [])
      .filter(
        (o) =>
          !["unknown", "none"].includes(o.code) &&
          answer.descriptor_codes.includes(o.code),
      )
      .map((o) => o.label);
    return labels.length ? labels.join(" · ") : null;
  }
  for (const field of fields) {
    if (
      !/^(nose$|palate|body|finish|alcohol|sweetness|acidity|tannin|carbonation|texture)/.test(
        field.id,
      )
    )
      continue;
    const details = [pa, ca].every((map) =>
      map
        .get(field.id)
        ?.descriptor_codes.some((code) => code.startsWith("detail.")),
    );
    const before = value(field, pa, details),
      after = value(field, ca, details);
    if (!before || !after) continue;
    const label =
      (field.id === "nose" ? "향" : field.label?.split(" · ")[0]) ||
      (
        {
          nose: "향",
          palate: "맛",
          body: "무게감",
          finish: "여운",
          alcohol: "도수감",
        } as Record<string, string>
      )[field.id] ||
      "느낌";
    if (before === after) result.unchanged++;
    else result.changes.push({ label, before, after });
  }
  return result;
}
