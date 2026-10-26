import type { RecordComposerDraft } from "./composer-draft";
import type { RecordInput, SavedRecord } from "./repository";
export type PendingRecord = {
  version: 1;
  ownerId: string;
  operationId: string;
  input: RecordInput;
  entryId?: string;
  localPhoto?: string;
  composerDraft?: RecordComposerDraft;
  saved?: SavedRecord;
};
export type SavePorts = {
  ownerId: () => string | null;
  read: () => Promise<PendingRecord | null>;
  write: (pending: PendingRecord) => Promise<void>;
  upload: (path: string, localUri: string) => Promise<void>;
  save: (
    operationId: string,
    input: RecordInput,
    entryId: string | null,
  ) => Promise<SavedRecord>;
};
/** Never changes the input/operation when an upload or RPC response is uncertain. */
export async function submitPending(pending: PendingRecord, ports: SavePorts) {
  const checkOwner = () => {
    if (ports.ownerId() !== pending.ownerId)
      throw new Error("로그인 계정이 변경됐어요. 다시 로그인해주세요.");
  };
  checkOwner();
  const existing = await ports.read();
  if (existing && existing.operationId !== pending.operationId)
    throw new Error("이전에 저장하던 기록을 먼저 완료해주세요.");
  if (existing && (existing.entryId ?? null) !== (pending.entryId ?? null))
    throw new Error(
      "저장 중인 술 연결을 변경할 수 없어요. 원래 기록을 다시 시도해주세요.",
    );
  if (
    existing &&
    JSON.stringify(existing.input) !== JSON.stringify(pending.input)
  )
    throw new Error("저장 중인 원래 기록을 다시 시도해주세요.");
  if (
    existing &&
    JSON.stringify(existing.composerDraft) !==
      JSON.stringify(pending.composerDraft)
  )
    throw new Error("저장 중인 원래 초안을 다시 시도해주세요.");
  checkOwner();
  // A mounted screen may still hold the pre-response draft after a previous attempt
  // persisted its receipt. Never downgrade that receipt or upload/save again.
  const receipt = existing?.saved ?? pending.saved;
  if (receipt) return receipt;
  await ports.write(pending);
  if (pending.input.photo && pending.localPhoto) {
    checkOwner();
    await ports.upload(pending.input.photo.storagePath, pending.localPhoto);
  }
  checkOwner();
  const result = await ports.save(
    pending.operationId,
    pending.input,
    pending.entryId ?? null,
  );
  // Save receipt even if the active account changed while awaiting the server.
  await ports.write({ ...pending, saved: result });
  checkOwner();
  return result;
}
