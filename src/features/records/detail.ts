import {
  compareRecords,
  type ComparisonAnswer,
  type RecordComparison,
} from "./comparison";
import { signPhotoBatch } from "./photo-links";
import type { SupabaseClient } from "@supabase/supabase-js";
export type RecordDetail = {
  id: string;
  revision: number;
  cellar_entry_id: string;
  entered_name: string | null;
  category: string | null;
  consumed_at: string;
  revisit: "again" | "okay" | "not_for_me" | null;
  rating: number | null;
  vintage_status: string | null;
  vintage_year: number | null;
  record_photos: {
    storage_path: string;
    sort_order: number;
    upload_status: string;
  }[];
  record_answers?: ComparisonAnswer[];
  record_notes: {
    confirmed_note: string | null;
    mode: string;
    catalog_version: number;
    input_revision?: number;
    confirmed_input_revision?: number | null;
  } | null;
};
export async function loadRecordDetail(
  client: SupabaseClient,
  owner: string,
  target: { recordId?: string; entryId?: string },
  signal: AbortSignal = AbortSignal.timeout(20000),
) {
  if (!target.recordId && !target.entryId) throw new Error("Missing record");
  let query = client
    .from("tasting_records")
    .select(
      "id,revision,cellar_entry_id,entered_name,category,consumed_at,revisit,rating,vintage_status,vintage_year,record_photos(storage_path,sort_order,upload_status),record_notes(confirmed_note,mode,catalog_version,input_revision,confirmed_input_revision),record_answers(mode,catalog_version,question_id,status,descriptor_codes)",
    )
    .eq("user_id", owner);
  query = target.recordId
    ? query.eq("id", target.recordId)
    : query.eq("cellar_entry_id", target.entryId!);
  const { data, error } = await query
    .order("consumed_at", { ascending: false })
    .order("id")
    .limit(1)
    .abortSignal(signal)
    .single();
  if (error) throw error;
  const raw = data as unknown as Omit<RecordDetail, "record_notes"> & {
    record_notes:
      | RecordDetail["record_notes"]
      | NonNullable<RecordDetail["record_notes"]>[];
  };
  // PostgREST returns the reverse composite FK relation as an array, even though record_id is unique.
  const record: RecordDetail = {
    ...raw,
    record_notes: Array.isArray(raw.record_notes)
      ? (raw.record_notes[0] ?? null)
      : raw.record_notes,
  };
  // A bounded history fetch, separately owner constrained, never selects another user's records.
  const { data: history, error: historyError } = await client
    .from("tasting_records")
    .select("id,consumed_at")
    .eq("user_id", owner)
    .eq("cellar_entry_id", record.cellar_entry_id)
    .order("consumed_at", { ascending: false })
    .order("id")
    .limit(100)
    .abortSignal(signal);
  if (historyError) throw historyError;
  let comparison: RecordComparison | undefined;
  let comparisonFailed = false;
  const index = (history ?? []).findIndex((r) => r.id === record.id);
  const previous = index >= 0 ? history?.[index + 1] : null;
  if (previous) {
    const { data: earlier, error: comparisonError } = await client
      .from("tasting_records")
      .select(
        "id,cellar_entry_id,category,consumed_at,revisit,vintage_status,vintage_year,record_notes(confirmed_note,mode,catalog_version,input_revision,confirmed_input_revision),record_answers(mode,catalog_version,question_id,status,descriptor_codes)",
      )
      .eq("user_id", owner)
      .eq("cellar_entry_id", record.cellar_entry_id)
      .eq("id", previous.id)
      .abortSignal(signal)
      .maybeSingle();
    if (comparisonError || !earlier) comparisonFailed = true;
    else {
      const rawEarlier = earlier as unknown as RecordDetail;
      const notes = rawEarlier.record_notes;
      comparison =
        compareRecords(record, {
          ...rawEarlier,
          record_notes: Array.isArray(notes) ? (notes[0] ?? null) : notes,
        }) ?? undefined;
    }
  }
  const photo = record.record_photos
    .filter((p) => p.upload_status === "ready")
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  let photoUri: string | null = null;
  if (photo && photo.storage_path.startsWith(`${owner}/records/`)) {
    const signed = await signPhotoBatch(client, [photo.storage_path]).catch(
      () => new Map<string, string>(),
    );
    photoUri = signed.get(photo.storage_path) ?? null;
  }
  const result: {
    record: RecordDetail;
    history: { id: string; consumed_at: string }[];
    photoUri: string | null;
    comparison?: RecordComparison;
    comparisonFailed?: boolean;
  } = { record, history: history ?? [], photoUri };
  if (comparison) result.comparison = comparison;
  if (comparisonFailed) result.comparisonFailed = true;
  return result;
}
export function recordDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
