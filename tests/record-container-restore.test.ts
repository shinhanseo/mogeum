import assert from "node:assert/strict";
import test from "node:test";
import { decodePendingRecord } from "../src/features/records/pending-restore";
import { decodePreparedAttachment } from "../src/features/records/attachment-restore";
import {
  submitAttachment,
  type PendingAttachment,
} from "../src/features/records/attachment";
const owner = "90000000-0000-4000-8000-000000000001";
const operation = "90000000-0000-4000-8000-000000000002";
const record = "90000000-0000-4000-8000-000000000003";
const oldRoot =
  "file:///var/mobile/Containers/Data/Application/10000000-0000-4000-8000-000000000001/Documents/";
const directory = oldRoot.replace(
  "10000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000001",
);
const photo = {
  storagePath: `${owner}/records/${operation}/photo.jpg`,
  width: 900,
  height: 1200,
};
const localPhoto = `${oldRoot}record-drafts/${operation}.jpg`;
const current = `${directory}record-drafts/${operation}.jpg`;
const pending = {
  version: 1,
  ownerId: owner,
  operationId: operation,
  input: { enteredName: "합성 기록", photo },
  localPhoto,
};
const attachment: PendingAttachment = {
  version: 1,
  owner,
  recordId: record,
  operationId: operation,
  expectedRevision: 4,
  change: { kind: "photo", ...photo },
  localPhoto,
};
test("record relocation changes only the local photo and preserves original storage and receipt", () => {
  const saved = {
    recordId: record,
    cellarEntryId: owner,
    revision: 1,
    replayed: true,
  };
  const raw = JSON.stringify({ ...pending, saved });
  const decoded = decodePendingRecord(raw, owner, directory);
  assert.equal(decoded.localPhoto, current);
  assert.deepEqual(decoded.input, pending.input);
  assert.deepEqual(decoded.saved, saved);
  assert.equal(decoded.operationId, operation);
  assert.equal(JSON.parse(raw).localPhoto, localPhoto);
});
test("record and replacement relocation cannot cross owners, operations or arbitrary roots", () => {
  for (const uri of [
    localPhoto.replace(operation, record),
    localPhoto + "?x=1",
    localPhoto.replace("/Documents/", "/Library/"),
    localPhoto.replace("/var/mobile/", "/private/var/mobile/"),
  ]) {
    assert.throws(() =>
      decodePendingRecord(
        JSON.stringify({ ...pending, localPhoto: uri }),
        owner,
        directory,
      ),
    );
    assert.throws(() =>
      decodePreparedAttachment(
        JSON.stringify({ ...attachment, localPhoto: uri }),
        owner,
        record,
        directory,
      ),
    );
  }
  assert.throws(() =>
    decodePendingRecord(JSON.stringify(pending), "other", directory),
  );
  assert.throws(() =>
    decodePreparedAttachment(
      JSON.stringify(attachment),
      "other",
      record,
      directory,
    ),
  );
  assert.throws(() =>
    decodePreparedAttachment(
      JSON.stringify(attachment),
      owner,
      "other",
      directory,
    ),
  );
  assert.throws(() =>
    decodePreparedAttachment(
      JSON.stringify(attachment),
      owner,
      record,
      "file:///arbitrary/Documents/",
    ),
  );
});
test("replacement retry normalizes both sides before comparing identity and uploads only current sandbox", async () => {
  const raw = JSON.stringify(attachment);
  let disk = raw;
  let uploads = 0;
  let applies = 0;
  const result = {
    recordId: record,
    cellarEntryId: owner,
    revision: 5,
    replayed: false,
  };
  const run = () =>
    submitAttachment(decodePreparedAttachment(raw, owner, record, directory), {
      owner: () => owner,
      read: async () =>
        decodePreparedAttachment(disk, owner, record, directory),
      write: async (value) => {
        disk = JSON.stringify(value);
      },
      upload: async (path, uri) => {
        uploads++;
        assert.equal(uri, current);
        assert.equal(path, photo.storagePath);
      },
      apply: async (value) => {
        applies++;
        assert.equal(value.expectedRevision, 4);
        assert.equal(value.operationId, operation);
        assert.deepEqual(value.change, attachment.change);
        return result;
      },
    });
  assert.deepEqual(await run(), result);
  assert.deepEqual(await run(), result);
  assert.equal(uploads, 1);
  assert.equal(applies, 1);
  assert.equal(JSON.parse(raw).localPhoto, localPhoto);
});
