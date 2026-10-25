import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteAccount,
  type AccountDeletionPorts,
} from "../supabase/functions/_shared/account-deletion";
function harness() {
  let complete = false;
  const events: string[] = [];
  let photos = ["owner/records/photo.jpg"];
  const ports: AccountDeletionPorts = {
    completed: async () => complete,
    authenticate: async () => "owner",
    begin: async () => {
      events.push("freeze");
      return true;
    },
    revoke: async () => {
      events.push("providers");
    },
    files: async () => photos,
    remove: async () => {
      events.push("photos");
      photos = [];
    },
    purge: async () => {
      events.push("db");
    },
    deleteAuth: async () => {
      events.push("auth");
    },
    finish: async () => {
      events.push("receipt");
      complete = true;
    },
    release: async () => {
      events.push("release");
    },
  };
  return {
    ports,
    events,
    setPhotos: (p: string[]) => {
      photos = p;
    },
  };
}
test("deletion freezes first, removes binary before DB/Auth, and a lost response replays only the completed receipt", async () => {
  const h = harness();
  assert.deepEqual(await deleteAccount(h.ports, "lease"), {
    state: "complete",
  });
  assert.deepEqual(h.events, [
    "freeze",
    "providers",
    "photos",
    "db",
    "auth",
    "receipt",
    "release",
  ]);
  h.events.length = 0;
  assert.deepEqual(await deleteAccount(h.ports, "retry"), {
    state: "complete",
  });
  assert.deepEqual(h.events, []);
});
test("photo removal failure never deletes records/Auth; retry can continue and lease is released", async () => {
  const h = harness(),
    remove = h.ports.remove;
  h.ports.remove = async () => {
    throw Error("storage offline");
  };
  await assert.rejects(deleteAccount(h.ports, "lease"), /offline/);
  assert.deepEqual(h.events, ["freeze", "providers", "release"]);
  h.ports.remove = remove;
  assert.deepEqual(await deleteAccount(h.ports, "retry"), {
    state: "complete",
  });
});
test("foreign storage paths never reach the deletion API", async () => {
  const h = harness();
  h.setPhotos(["other/records/private.jpg"]);
  await assert.rejects(deleteAccount(h.ports, "lease"), /INVALID_PHOTO_PATH/);
  assert.deepEqual(h.events, ["freeze", "providers", "release"]);
});
test("unauthenticated requests and another active worker cannot begin destructive work", async () => {
  const h = harness();
  h.ports.authenticate = async () => null;
  await assert.rejects(deleteAccount(h.ports, "lease"), /UNAUTHENTICATED/);
  assert.deepEqual(h.events, []);
  h.ports.authenticate = async () => "owner";
  h.ports.begin = async () => false;
  assert.deepEqual(await deleteAccount(h.ports, "lease"), { state: "running" });
  assert.deepEqual(h.events, []);
});
test("large deletions are bounded and retain a pending state until a later request", async () => {
  const h = harness();
  h.ports.remove = async () => {
    h.events.push("photos");
  };
  assert.deepEqual(await deleteAccount(h.ports, "lease"), { state: "running" });
  assert.equal(h.events.filter((e) => e === "photos").length, 10);
  assert.ok(!h.events.includes("auth"));
  assert.equal(h.events.at(-1), "release");
});

test("provider failure preserves all photos, records and Auth and releases its lease", async () => {
  const h = harness();
  h.ports.revoke = async () => {
    throw Error("provider offline");
  };
  await assert.rejects(deleteAccount(h.ports, "lease"), /offline/);
  assert.deepEqual(h.events, ["freeze", "release"]);
});
