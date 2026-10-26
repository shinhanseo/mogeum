import assert from "node:assert/strict";
import test from "node:test";
import {
  legalDocumentUrl,
  openLegalDocument,
} from "../src/lib/legal-documents";
test("legal document configuration only opens public HTTPS pages", () => {
  for (const value of [
    undefined,
    "",
    "javascript:alert(1)",
    "file:///private/token",
    "http://site.com/privacy",
    "https://user:password@site.com",
    "https://127.0.0.1/privacy",
    "https://[::1]/",
    "https://localhost/",
    "https://example.com/",
    "https://site.invalid/",
  ])
    assert.equal(legalDocumentUrl(value), null);
  assert.equal(
    legalDocumentUrl("https://mogeum.app/privacy"),
    "https://mogeum.app/privacy",
  );
});
test("missing legal URL never invokes external browser; open errors are recoverable", async () => {
  let calls = 0;
  const open = async () => {
    calls++;
  };
  assert.equal(await openLegalDocument(undefined, open), "unconfigured");
  assert.equal(calls, 0);
  assert.equal(
    await openLegalDocument("https://mogeum.app/terms", open),
    "opened",
  );
  assert.equal(calls, 1);
  assert.equal(
    await openLegalDocument("https://mogeum.app/terms", async () => {
      throw Error("offline");
    }),
    "failed",
  );
});
