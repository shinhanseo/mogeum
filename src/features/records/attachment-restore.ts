import { currentDocumentUri } from "../../lib/document-uri";
import { decodePendingAttachment } from "./attachment";
import { isPreparedRecordPhoto } from "./draft-photo";

/** Resolve only this operation's prepared photo; reading never rewrites the pending request. */
export function decodePreparedAttachment(
  raw: string,
  owner: string,
  recordId: string,
  directory: string | null,
  web = false,
) {
  if (raw.length > 16000000)
    throw new Error("보관한 변경 요청을 읽지 못했어요.");
  const value = decodePendingAttachment(raw, owner, recordId);
  if (value.change.kind === "photo") {
    if (!web) {
      const uri = currentDocumentUri(
        value.localPhoto,
        directory,
        `record-drafts/${value.operationId}.jpg`,
      );
      if (!uri) throw new Error("보관한 사진을 확인해주세요.");
      value.localPhoto = uri;
    }
    if (
      !isPreparedRecordPhoto(
        value.localPhoto,
        value.operationId,
        directory,
        web,
      )
    )
      throw new Error("보관한 사진을 확인해주세요.");
  }
  return value;
}
