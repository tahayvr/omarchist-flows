// The Worker against stand-ins for R2 and D1. D1 is SQLite, so Node's own
// SQLite runs the same statements.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, test } from "node:test";

import { forgetIndex, handle } from "../src/index.js";

function bucket(objects) {
  return {
    async get(key) {
      if (!(key in objects)) return null;
      const body = objects[key];
      return {
        body,
        httpEtag: `"${key.length}-${body.length}"`,
        async json() {
          return JSON.parse(body);
        },
      };
    },
  };
}

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const statement = (sql, values = []) => ({
    bind: (...bound) => statement(sql, bound),
    async run() {
      const result = db.prepare(sql).run(...values);
      return { meta: { changes: Number(result.changes) } };
    },
    async all() {
      return { results: db.prepare(sql).all(...values) };
    },
  });
  return { prepare: (sql) => statement(sql) };
}

// As CI publishes it: the index's text and the signature of that text.
const index = JSON.stringify({
  signed: JSON.stringify({ version: 1, flows: [{ slug: "timer" }, { slug: "save-link" }] }),
  signature: "c2lnbmF0dXJl",
});
let env;

beforeEach(() => {
  forgetIndex();
  env = {
    SALT: "pepper",
    DB: database(),
    BUCKET: bucket({
      "v1/index.json": index,
      "v1/flows/timer/1.flow.toml": 'name = "Timer"\n',
    }),
  };
});

const get = (path, headers = {}) =>
  handle(new Request(`https://flows.omarchist.com${path}`, { headers }), env);

const install = (body, address = "203.0.113.7", now = Date.parse("2026-10-05T10:00:00Z")) =>
  handle(
    new Request("https://flows.omarchist.com/v1/installs", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": address },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
    now,
  );

const counts = async () => (await get("/v1/installs.json")).json();

test("the index and a flow file come from the bucket", async () => {
  const response = await get("/v1/index.json");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), index);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal(response.headers.get("cache-control"), "public, max-age=120");

  const flow = await get("/v1/flows/timer/1.flow.toml");
  assert.equal(await flow.text(), 'name = "Timer"\n');
  assert.match(flow.headers.get("cache-control"), /immutable/);
  assert.equal(flow.headers.get("x-content-type-options"), "nosniff");
});

test("a second request is answered from the cache", async () => {
  const stored = new Map();
  globalThis.caches = {
    default: {
      match: async (request) => stored.get(request.url)?.clone(),
      put: async (request, response) => void stored.set(request.url, response),
    },
  };
  const waiting = [];
  const ctx = { waitUntil: (promise) => waiting.push(promise) };
  const url = "https://flows.omarchist.com/v1/installs.json";
  try {
    await install({ slug: "timer", version: 1 });
    const first = await handle(new Request(url), env, undefined, ctx);
    await Promise.all(waiting);
    assert.deepEqual(await first.json(), { timer: 1 });
    // Counted meanwhile, but the cached answer stands until it expires.
    await install({ slug: "save-link", version: 1 });
    const second = await handle(new Request(url), env, undefined, ctx);
    assert.deepEqual(await second.json(), { timer: 1 });
    // What is not there is not remembered as missing.
    const missing = "https://flows.omarchist.com/v1/flows/timer/9.flow.toml";
    assert.equal((await handle(new Request(missing), env, undefined, ctx)).status, 404);
    assert.ok(!stored.has(missing));
  } finally {
    delete globalThis.caches;
  }
});

test("an unchanged file answers 304", async () => {
  const etag = (await get("/v1/index.json")).headers.get("etag");
  const again = await get("/v1/index.json", { "if-none-match": etag });
  assert.equal(again.status, 304);
});

test("nothing outside the catalog's own paths is served", async () => {
  for (const path of [
    "/",
    "/v1/",
    "/v1/flows/timer/2.flow.toml",
    "/v1/flows/timer/1.flow.toml.bak",
    "/v1/flows/timer/secrets/1.flow.toml",
    "/v1/flows/Timer/1.flow.toml",
    "/v1/flows/timer/01.flow.toml",
    "/v1/secret.json",
    "/v1/index.json.sig",
    "/v2/index.json",
  ]) {
    assert.equal((await get(path)).status, 404, path);
  }
  const put = await handle(
    new Request("https://flows.omarchist.com/v1/index.json", { method: "PUT", body: "x" }),
    env,
  );
  assert.equal(put.status, 405);
});

test("an install is counted once per address, flow and day", async () => {
  assert.deepEqual(await counts(), {});
  assert.equal((await install({ slug: "timer", version: 1 })).status, 204);
  assert.equal((await install({ slug: "timer", version: 1 })).status, 204);
  assert.deepEqual(await counts(), { timer: 1 });

  // Somebody else, another flow, and the same person the next day all count.
  await install({ slug: "timer", version: 1 }, "198.51.100.9");
  await install({ slug: "save-link", version: 2 });
  await install({ slug: "timer", version: 1 }, "203.0.113.7", Date.parse("2026-10-06T10:00:00Z"));
  assert.deepEqual(await counts(), { timer: 3, "save-link": 1 });
});

test("yesterday's hashes are deleted", async () => {
  await install({ slug: "timer", version: 1 });
  await install({ slug: "save-link", version: 1 }, "198.51.100.9", Date.parse("2026-10-06T10:00:00Z"));
  const { results } = await env.DB.prepare("SELECT day FROM seen").all();
  assert.deepEqual(results.map((row) => row.day), ["2026-10-06"]);
});

test("what is kept is a hash, not the address", async () => {
  await install({ slug: "timer", version: 1 });
  const { results } = await env.DB.prepare("SELECT key FROM seen").all();
  assert.match(results[0].key, /^[0-9a-f]{64}$/);
  assert.ok(!results[0].key.includes("203.0.113.7"));
});

test("a count for nothing real is refused", async () => {
  assert.equal((await install({ slug: "no-such-flow", version: 1 })).status, 404);
  assert.equal((await install({ slug: "Timer", version: 1 })).status, 400);
  assert.equal((await install({ slug: "timer", version: 0 })).status, 400);
  assert.equal((await install({ slug: "timer", version: "1" })).status, 400);
  assert.equal((await install({ slug: "timer'; DROP TABLE installs;--", version: 1 })).status, 400);
  assert.equal((await install("not json")).status, 400);
  assert.equal((await install("null")).status, 400);
  assert.deepEqual(await counts(), {});
});

test("the rate limit turns an eager address away", async () => {
  let allowed = 2;
  env.INSTALLS_LIMIT = { limit: async () => ({ success: allowed-- > 0 }) };
  assert.equal((await install({ slug: "timer", version: 1 })).status, 204);
  assert.equal((await install({ slug: "save-link", version: 1 })).status, 204);
  assert.equal((await install({ slug: "timer", version: 1 }, "203.0.113.7")).status, 429);
});
