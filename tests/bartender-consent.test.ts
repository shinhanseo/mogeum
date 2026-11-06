import test from "node:test";
import assert from "node:assert/strict";
import {
  createBartenderConsent,
  BARTENDER_CONSENT_VERSION,
  bartenderConsentKey,
} from "../src/features/bartender/consent";
import { localDataOwner } from "../src/features/auth/deletion-local";
test("chat is not sent before affirmative consent; decline is a no-op", async () => {
  let sent = 0,
    written = 0,
    agree: (() => void) | undefined;
  const gate = createBartenderConsent({
    read: async () => null,
    write: async () => {
      written++;
    },
    active: () => true,
    ask: (a) => {
      agree = a;
    },
    error: () => assert.fail(),
  });
  await gate.run(() => sent++);
  assert.equal(sent, 0);
  assert.equal(written, 0);
  assert.ok(agree);
});
test("accepted consent is scoped to account and sends only after successful persistence", async () => {
  let sent = 0,
    stored = "";
  let agree = () => {};
  const gate = createBartenderConsent({
    read: async () => null,
    write: async (v) => {
      stored = v;
    },
    active: () => true,
    ask: (a) => {
      agree = a;
    },
    error: () => assert.fail(),
  });
  await gate.run(() => sent++);
  agree();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(stored, BARTENDER_CONSENT_VERSION);
  assert.equal(sent, 1);
  await gate.run(() => sent++);
  assert.equal(sent, 2);
  const owner = "11111111-1111-4111-8111-111111111111";
  assert.equal(localDataOwner(bartenderConsentKey(owner)), owner);
});
test("write failure or an unmounted screen cannot send a chat", async () => {
  for (const failure of ["write", "unmount"]) {
    let sent = 0,
      errors = 0,
      active = true,
      agree = () => {};
    const gate = createBartenderConsent({
      read: async () => null,
      write: async () => {
        if (failure === "write") throw Error("storage");
      },
      active: () => active,
      ask: (a) => {
        agree = a;
      },
      error: () => errors++,
    });
    await gate.run(() => sent++);
    if (failure === "unmount") active = false;
    agree();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(sent, 0);
    assert.equal(errors, failure === "write" ? 1 : 0);
  }
});
