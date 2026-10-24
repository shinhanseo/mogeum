import assert from "node:assert/strict";
import test from "node:test";
import { currentDocumentUri } from "../src/lib/document-uri";
const before = "14422F63-BB97-4116-9AA5-37DD3F82D4F1";
const after = "2A8FBFC8-9D84-4073-AF03-61EE1FE96BBD";
const simulator =
  "file:///Users/synthetic/Library/Developer/CoreSimulator/Devices/2BDC9027-40B0-4087-8AA6-7429B1854B63/data/Containers/Data/Application/";
const relative = "menu-drafts/owner/session/photo-1.jpg";
test("container relocation resolves to the exact current sandbox file on iOS devices and simulator", () => {
  for (const prefix of [
    simulator,
    "file:///var/mobile/Containers/Data/Application/",
    "file:///private/var/mobile/Containers/Data/Application/",
  ]) {
    const directory = `${prefix}${after}/Documents/`;
    assert.equal(
      currentDocumentUri(
        `${prefix}${before}/Documents/${relative}`,
        directory,
        relative,
      ),
      directory + relative,
    );
    assert.equal(
      currentDocumentUri(directory + relative, directory, relative),
      directory + relative,
    );
  }
});
test("foreign owners, revisions, cache paths, device roots, URLs and traversal never become trusted local files", () => {
  const directory = `${simulator}${after}/Documents/`;
  const old = `${simulator}${before}/Documents/`;
  for (const uri of [
    old + "menu-drafts/other/session/photo-1.jpg",
    old + relative.replace("-1", "-2"),
    old + "../Documents/" + relative,
    old.replace("Documents/", "Library/Caches/") + relative,
    old.replace("2BDC9027", "3BDC9027") + relative,
    "https://example.test/" + relative,
    old + relative + "?q=1",
    old + relative + "#fragment",
    old + relative.replace("owner", "%6fwner"),
    "file:///other/Documents/" + relative,
  ])
    assert.equal(currentDocumentUri(uri, directory, relative), null);
  for (const path of [
    "../photo.jpg",
    "/photo.jpg",
    "a//b",
    "a\\b",
    "a%2fb",
    "a?b",
    "a#b",
  ])
    assert.equal(currentDocumentUri(directory + path, directory, path), null);
});
test("other platforms keep exact existing paths without accepting a moved arbitrary root", () => {
  assert.equal(
    currentDocumentUri(
      "file:///synthetic/" + relative,
      "file:///synthetic/",
      relative,
    ),
    "file:///synthetic/" + relative,
  );
  assert.equal(
    currentDocumentUri(
      "file:///old/" + relative,
      "file:///synthetic/",
      relative,
    ),
    null,
  );
  assert.equal(currentDocumentUri(null, null, relative), null);
});
