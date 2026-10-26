import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type RequestListener } from "node:http";
import { once } from "node:events";
import { createDeadlineFetch } from "../src/lib/deadline-fetch";

async function localServer(action: RequestListener) {
  const server = createServer(action);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Expected TCP listener");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}

test("deadline aborts a real HTTP response stalled before headers", async () => {
  const server = await localServer(() => {});
  try {
    await assert.rejects(
      createDeadlineFetch(fetch, 80)(server.url),
      (error) => (error as Error).name === "TimeoutError",
    );
  } finally {
    server.close();
  }
});

test("body stalled after successful headers remains bounded", async () => {
  const server = await localServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.flushHeaders();
    res.write('{"incomplete":');
  });
  try {
    const response = await createDeadlineFetch(fetch, 150)(server.url);
    assert.equal(response.status, 200);
    await assert.rejects(response.json(), (error) =>
      ["AbortError", "TimeoutError"].includes((error as Error).name),
    );
  } finally {
    server.close();
  }
});

test("caller cancellation is preserved for init and Request signals; already cancelled calls never transmit", async () => {
  let calls = 0;
  const wrapped = createDeadlineFetch(async () => {
    calls++;
    return new Response("unexpected");
  });
  const stopped = new AbortController();
  stopped.abort(Error("caller stopped"));
  await assert.rejects(
    wrapped("http://example.test", { signal: stopped.signal }),
    /caller stopped/,
  );
  await assert.rejects(
    wrapped(new Request("http://example.test", { signal: stopped.signal })),
    /caller stopped/,
  );
  await assert.rejects(
    wrapped(new Request("http://example.test", { signal: stopped.signal }), {
      signal: undefined,
    }),
    /caller stopped/,
  );
  assert.equal(calls, 0);
  const controller = new AbortController();
  const server = await localServer(() => {
    controller.abort(Error("caller cancelled in flight"));
  });
  try {
    await assert.rejects(
      createDeadlineFetch(fetch, 1000)(server.url, {
        signal: controller.signal,
      }),
      /caller cancelled in flight/,
    );
  } finally {
    server.close();
  }
});

test("a completed request keeps method, body and headers; explicit null can replace a Request signal", async () => {
  const server = await localServer((req, res) => {
    let body = "";
    req.on("data", (b) => (body += b));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          method: req.method,
          tag: req.headers["x-test"],
          body,
        }),
      );
    });
  });
  try {
    const stopped = new AbortController();
    stopped.abort();
    const response = await createDeadlineFetch(fetch, 1000)(
      new Request(server.url, { signal: stopped.signal }),
      {
        signal: null,
        method: "POST",
        body: "preserved operation",
        headers: { "x-test": "qa" },
      },
    );
    assert.deepEqual(await response.json(), {
      method: "POST",
      tag: "qa",
      body: "preserved operation",
    });
  } finally {
    server.close();
  }
});
