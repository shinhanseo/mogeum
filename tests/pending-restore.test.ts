import assert from "node:assert/strict";
import test from "node:test";
import { decodePendingRecord } from "../src/features/records/pending-restore";
import { isPreparedRecordPhoto } from "../src/features/records/draft-photo";
import type { PendingRecord } from "../src/features/records/pending";
const owner = "90000000-0000-4000-8000-000000000001";
const operation = "90000000-0000-4000-8000-000000000002";
const record = "90000000-0000-4000-8000-000000000003";
const entry = "90000000-0000-4000-8000-000000000004";
const directory = "file:///synthetic/app/Documents/";
const uri = `${directory}record-drafts/${operation}.jpg`;
const fixture = (): PendingRecord => ({
  version: 1,
  ownerId: owner,
  operationId: operation,
  input: {
    enteredName: "술",
    photo: {
      storagePath: `${owner}/records/${operation}/photo.jpg`,
      width: 900,
      height: 1200,
    },
  },
  localPhoto: uri,
});
const decode = (v: unknown) =>
  decodePendingRecord(JSON.stringify(v), owner, directory);
test("canonical draft and saved receipt restore without changing operation or payload", () => {
  const value = fixture();
  assert.deepEqual(decode(value), value);
  const receipt = {
    ...value,
    saved: {
      recordId: record,
      cellarEntryId: entry,
      revision: 1,
      replayed: true,
    },
  };
  delete receipt.localPhoto;
  assert.deepEqual(decode(receipt), receipt);
  assert.deepEqual(
    decode({
      version: 1,
      ownerId: owner,
      operationId: operation,
      input: { enteredName: "이름만" },
    }).input,
    { enteredName: "이름만" },
  );
});
test("native draft source cannot escape its exact operation filename or sandbox", () => {
  for (const bad of [
    `${directory}record-drafts/../other.jpg`,
    `${directory}record-drafts/%2e%2e/other.jpg`,
    `${directory}record-drafts/${record}.jpg`,
    `${directory}record-drafts/${operation}.jpg/../other.jpg`,
    `${directory}record-drafts/${operation}.jpg?file=other`,
    "file:///private/other.jpg",
    "https://synthetic.example.test/photo.jpg",
    "data:image/jpeg;base64,/9j/2Q==",
  ]) {
    assert.equal(isPreparedRecordPhoto(bad, operation, directory), false);
    assert.throws(() => decode({ ...fixture(), localPhoto: bad }));
  }
  assert.equal(isPreparedRecordPhoto(uri, operation, directory), true);
  assert.equal(
    isPreparedRecordPhoto(uri, operation, "file:///different/Documents/"),
    false,
  );
});
test("corrupt records, ownership, remote path, dimensions and receipts fail instead of becoming an empty draft", () => {
  const value = fixture();
  for (const bad of [
    null,
    [],
    {},
    { ...value, ownerId: "other" },
    { ...value, operationId: "../x" },
    { ...value, input: null },
    { ...value, input: [] },
    { ...value, entryId: "foreign" },
    {
      ...value,
      input: {
        photo: {
          ...value.input.photo,
          storagePath: `other/records/${operation}/photo.jpg`,
        },
      },
    },
    { ...value, input: { photo: { ...value.input.photo, width: 0 } } },
    { ...value, input: { photo: { ...value.input.photo, height: 20001 } } },
    { ...value, localPhoto: undefined },
    {
      ...value,
      saved: {
        recordId: record,
        cellarEntryId: entry,
        revision: 0,
        replayed: true,
      },
    },
    {
      ...value,
      saved: {
        recordId: "wrong",
        cellarEntryId: entry,
        revision: 1,
        replayed: true,
      },
    },
    { ...value, input: { enteredName: "no photo" } },
  ])
    assert.throws(() => decode(bad));
  assert.throws(() => decodePendingRecord("", owner, directory));
  assert.throws(() => decodePendingRecord("{", owner, directory));
});
test("web restores only bounded JPEG data rather than arbitrary remote or native URIs", () => {
  const data = "data:image/jpeg;base64,/9j/2Q==";
  const value = { ...fixture(), localPhoto: data };
  assert.equal(
    decodePendingRecord(JSON.stringify(value), owner, null, true).localPhoto,
    data,
  );
  for (const bad of [
    uri,
    "https://synthetic.example.test/photo.jpg",
    "data:text/html;base64,SGk=",
    "data:image/jpeg;base64,A",
  ])
    assert.throws(() =>
      decodePendingRecord(
        JSON.stringify({ ...value, localPhoto: bad }),
        owner,
        null,
        true,
      ),
    );
});
