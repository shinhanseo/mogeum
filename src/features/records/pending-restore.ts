import { parseComposerDraft } from "./composer-draft";
import { currentDocumentUri } from "../../lib/document-uri";
import type { PendingRecord } from "./pending";
import { isPreparedRecordPhoto } from "./draft-photo";
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
/** Invalid drafts stay stored for recovery; a caller must never reinterpret them as empty storage. */
export function decodePendingRecord(
  raw: string,
  owner: string,
  directory: string | null,
  web = false,
): PendingRecord {
  const fail = (): never => {
    throw new Error("저장 중인 기록을 읽지 못했어요.");
  };
  if (raw.length > 16000000) fail();
  const value = JSON.parse(raw) as PendingRecord;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 1 ||
    value.ownerId !== owner ||
    !uuid(value.operationId) ||
    !value.input ||
    typeof value.input !== "object" ||
    Array.isArray(value.input) ||
    (value.entryId !== undefined && !uuid(value.entryId))
  )
    fail();
  if (value.composerDraft !== undefined) {
    value.composerDraft = parseComposerDraft(
      JSON.stringify(value.composerDraft),
      owner,
      value.composerDraft.context,
    );
  }
  const saved = value.saved;
  if (
    saved !== undefined &&
    (!saved ||
      !uuid(saved.recordId) ||
      !uuid(saved.cellarEntryId) ||
      !Number.isInteger(saved.revision) ||
      saved.revision < 1 ||
      typeof saved.replayed !== "boolean")
  )
    fail();
  if (value.input.photo !== undefined) {
    const photo = value.input.photo;
    if (
      !photo ||
      typeof photo !== "object" ||
      photo.storagePath !== `${owner}/records/${value.operationId}/photo.jpg` ||
      !Number.isInteger(photo.width) ||
      !Number.isInteger(photo.height) ||
      photo.width < 1 ||
      photo.height < 1 ||
      photo.width > 20000 ||
      photo.height > 20000
    )
      fail();
    if (!web && value.localPhoto !== undefined) {
      const uri = currentDocumentUri(
        value.localPhoto,
        directory,
        `record-drafts/${value.operationId}.jpg`,
      );
      if (!uri) fail();
      value.localPhoto = uri!;
    }
    if (
      value.localPhoto === undefined
        ? !saved
        : !isPreparedRecordPhoto(
            value.localPhoto,
            value.operationId,
            directory,
            web,
          )
    )
      fail();
  } else if (value.localPhoto !== undefined) fail();
  return value;
}
