import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { tastePhotoUrls } from "../src/features/taste/repository";
const owner = "90000000-0000-4000-8000-000000000001";
const path = (name: string) => `${owner}/records/${name}/photo.jpg`;
test("one batch signs first photos, associates by path instead of response order, and omits failures/foreign rows", async () => {
  let signingCalls = 0;
  const client = createClient(
    "https://synthetic.example.test",
    "synthetic-public-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, options) => {
          const url = new URL(String(input));
          if (url.pathname === "/rest/v1/record_photos") {
            assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
            assert.equal(url.searchParams.get("upload_status"), "eq.ready");
            return Response.json([
              { record_id: "a", storage_path: path("a"), sort_order: 0 },
              { record_id: "a", storage_path: path("later"), sort_order: 1 },
              { record_id: "b", storage_path: path("b"), sort_order: 0 },
              { record_id: "c", storage_path: path("c"), sort_order: 0 },
              {
                record_id: "unrequested",
                storage_path: path("hidden"),
                sort_order: 0,
              },
              {
                record_id: "d",
                storage_path: "foreign-owner/records/photo.jpg",
                sort_order: 0,
              },
            ]);
          }
          assert.equal(url.pathname, "/storage/v1/object/sign/record-photos");
          signingCalls++;
          const body = JSON.parse(String(options?.body));
          assert.deepEqual(body, {
            expiresIn: 300,
            paths: [path("a"), path("b"), path("c")],
          });
          return Response.json([
            { path: path("c"), signedURL: null, error: "not found" },
            {
              path: path("b"),
              signedURL: "/object/sign/b?token=synthetic",
              error: null,
            },
            {
              path: path("hidden"),
              signedURL: "/object/sign/hidden?token=synthetic",
              error: null,
            },
            {
              path: path("a"),
              signedURL: "/object/sign/a?token=synthetic",
              error: null,
            },
          ]);
        },
      },
    },
  );
  const urls = await tastePhotoUrls(client, owner, ["a", "a", "b", "c", "d"]);
  assert.deepEqual(Object.keys(urls).sort(), ["a", "b"]);
  assert.match(urls.a, /\/object\/sign\/a\?/);
  assert.match(urls.b, /\/object\/sign\/b\?/);
  assert.equal(signingCalls, 1);
});
test("empty photo selection never makes a signing request", async () => {
  const client = createClient(
    "https://synthetic.example.test",
    "synthetic-public-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async () => {
          throw new Error("must not fetch");
        },
      },
    },
  );
  assert.deepEqual(await tastePhotoUrls(client, owner, []), {});
});

test("stalled signing stops the UI wait and a late batch cannot return photos", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finish!: (response: Response) => void;
  let started = false;
  const client = createClient(
    "https://synthetic.example.test",
    "synthetic-public-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input) => {
          if (new URL(String(input)).pathname === "/rest/v1/record_photos")
            return Response.json([
              { record_id: "a", storage_path: path("a"), sort_order: 0 },
            ]);
          started = true;
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        },
      },
    },
  );
  const result = tastePhotoUrls(client, owner, ["a"]);
  const rejected = assert.rejects(result, /PHOTO_LINK_TIMEOUT/);
  await setImmediate();
  assert.equal(started, true);
  t.mock.timers.tick(10000);
  await rejected;
  finish(
    Response.json([
      { path: path("a"), signedURL: "/object/sign/a?token=late", error: null },
    ]),
  );
  await setImmediate();
  await assert.rejects(result, /PHOTO_LINK_TIMEOUT/);
});
