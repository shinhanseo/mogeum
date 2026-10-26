import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { withGeneratedRecordImage } from "../src/features/records/generated-image";

test("successful durable copy removes only this generated JPEG, retaining source, previous cache and draft", async () => {
  const root = await mkdtemp(join(tmpdir(), "mogeum-generated-"));
  try {
    const cache = join(root, "ImageManipulator");
    await mkdir(cache);
    const source = join(root, "picked.jpg"), generated = join(cache, "new-123.jpg"),
      unrelated = join(cache, "older.jpg"), target = join(root, "draft.jpg");
    await Promise.all([source, generated, unrelated].map(file => writeFile(file, "owned fixture")));
    const result = await withGeneratedRecordImage(
      { source: pathToFileURL(source).href, generated: pathToFileURL(generated).href,
        cacheDirectory: pathToFileURL(root).href + "/" },
      async () => { await copyFile(generated, target); return { target }; },
      uri => rm(new URL(uri)),
    );
    assert.equal(result.target, target);
    await assert.rejects(access(generated));
    for (const file of [source, target, unrelated]) assert.equal(await readFile(file, "utf8"), "owned fixture");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("directory/copy failure still releases generated output and preserves the original failure", async () => {
  for (const stage of ["directory", "copy"]) {
    const removed: string[] = [], failure = new Error(stage);
    await assert.rejects(withGeneratedRecordImage(
      { source: "file:///photos/original.jpg", generated: "file:///cache/ImageManipulator/abc-123.jpg", cacheDirectory: "file:///cache/" },
      async () => { throw failure; }, async uri => { removed.push(uri); },
    ), error => error === failure);
    assert.deepEqual(removed, ["file:///cache/ImageManipulator/abc-123.jpg"]);
  }
});

test("selected source, documents, another cache root and traversal cannot be removed", async () => {
  for (const [source, generated, cacheDirectory] of [
    ["file:///cache/ImageManipulator/original.jpg", "file:///cache/ImageManipulator/original.jpg", "file:///cache/"],
    ["file:/cache/ImageManipulator/result.jpg", "file:///cache/ImageManipulator/result.jpg", "file:///cache/"],
    ["file:///cache/ImageManipulator/%72esult.jpg", "file:///cache/ImageManipulator/result.jpg", "file:///cache/"],
    ["/cache/ImageManipulator/result.jpg", "file:///cache/ImageManipulator/result.jpg", "file:///cache/"],
    ["file:///photos/a.jpg", "file:///documents/record-drafts/photo.jpg", "file:///cache/"],
    ["file:///photos/a.jpg", "file:///cache-other/ImageManipulator/result.jpg", "file:///cache/"],
    ["file:///photos/a.jpg", "file:///cache/ImageManipulator/../result.jpg", "file:///cache/"],
    ["file:///photos/a.jpg", "file:///cache/ImageManipulator/%2e%2e/result.jpg", "file:///cache/"],
    ["file:///photos/a.jpg", "file:///cache/ImagePicker/selected.jpg", "file:///cache/"],
    ["file:///photos/a.jpg", "file:///cache/ImageManipulator/result.jpg", null],
  ]) {
    let removals = 0;
    assert.equal(await withGeneratedRecordImage({ source: source!, generated: generated!, cacheDirectory },
      async () => "durable", async () => { removals++; }), "durable");
    assert.equal(removals, 0);
  }
});

test("cleanup failure cannot turn a durable photo into an error or mask its copy failure", async () => {
  const image = { source: "file:///photos/a.jpg", generated: "file:///cache/ImageManipulator/result.jpg", cacheDirectory: "file:///cache/" };
  for (const remove of [async () => { throw Error("cache busy"); }, () => { throw Error("sync cleanup failure"); }]) {
    assert.equal(await withGeneratedRecordImage(image, async () => "durable", remove), "durable");
    const failed = new Error("copy failed");
    await assert.rejects(withGeneratedRecordImage(image, async () => { throw failed; }, remove), error => error === failed);
  }
});
