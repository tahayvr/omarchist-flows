// The Omarchist flow catalog's API. It serves what the repository's CI
// built and uploaded to R2 (a signed index and one file per flow version)
// and counts installs. It never changes the catalog: the index is signed
// in CI with a key this Worker does not have, and the app checks that
// signature, so a broken or hijacked Worker cannot hand out a flow nobody
// reviewed.
//
//   GET  /v1/index.json                      the list of flows with its
//                                            signature: { signed, signature }
//   GET  /v1/flows/<slug>/<version>.flow.toml  one flow, never rewritten
//   GET  /v1/installs.json                   { "<slug>": <count> }
//   POST /v1/installs  { slug, version }     count one install

const INDEX = "v1/index.json";
const FLOW = /^v1\/flows\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([1-9][0-9]{0,8})\.flow\.toml$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The index changes when a pull request is merged; two minutes is how
// long a new flow may take to show up.
const INDEX_CACHE = "public, max-age=120";
// A published version is never rewritten.
const FLOW_CACHE = "public, max-age=31536000, immutable";
const COUNTS_CACHE = "public, max-age=300";

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

const text = (body, status) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

function contentType(key) {
  if (key.endsWith(".json")) return "application/json; charset=utf-8";
  if (key.endsWith(".toml")) return "application/toml; charset=utf-8";
  return "text/plain; charset=utf-8";
}

async function serveObject(env, key, request) {
  const object = await env.BUCKET.get(key);
  if (!object) return text("Not found", 404);
  const headers = new Headers({
    "content-type": contentType(key),
    "cache-control": key === INDEX ? INDEX_CACHE : FLOW_CACHE,
    "x-content-type-options": "nosniff",
  });
  if (object.httpEtag) {
    headers.set("etag", object.httpEtag);
    if (request.headers.get("if-none-match") === object.httpEtag) {
      return new Response(null, { status: 304, headers });
    }
  }
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

async function installCounts(env) {
  const { results } = await env.DB.prepare("SELECT slug, count FROM installs").all();
  const counts = {};
  for (const row of results) counts[row.slug] = row.count;
  return json(counts, 200, { "cache-control": COUNTS_CACHE });
}

// Answers a GET from Cloudflare's cache when it can, so a busy day costs
// one read of R2 or D1 per few minutes and data centre, not one per
// request. The cache honours each response's own cache-control.
async function throughCache(request, ctx, produce) {
  if (typeof caches === "undefined" || request.method !== "GET") return produce();
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await produce();
  if (response.status === 200 && ctx) ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

// The slugs in the index, kept for a few minutes per isolate, so a count
// for a flow that does not exist is refused without a trip to R2.
let known = { slugs: null, at: 0 };

async function isKnownSlug(env, slug, now) {
  if (!known.slugs || now - known.at > 5 * 60 * 1000) {
    const object = await env.BUCKET.get(INDEX);
    if (!object) return false;
    // The published file wraps the index's text with its signature.
    const index = JSON.parse((await object.json()).signed);
    known = { slugs: new Set((index.flows || []).map((flow) => flow.slug)), at: now };
  }
  return known.slugs.has(slug);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// One install per address, flow and day. What is kept to know that is a
// salted hash, useless without the salt and deleted the next day; the
// address itself is never stored.
async function countInstall(env, request, now = Date.now()) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 1024) return text("Too large", 413);
  let body;
  try {
    body = JSON.parse((await request.text()).slice(0, 1024));
  } catch {
    return text("Expected JSON", 400);
  }
  const slug = body && body.slug;
  const version = body && body.version;
  if (typeof slug !== "string" || slug.length > 48 || !SLUG.test(slug)) {
    return text("Unknown flow", 400);
  }
  if (!Number.isInteger(version) || version < 1) return text("Unknown version", 400);

  const address = request.headers.get("cf-connecting-ip") || "unknown";
  if (env.INSTALLS_LIMIT) {
    const { success } = await env.INSTALLS_LIMIT.limit({ key: address });
    if (!success) return text("Slow down", 429);
  }
  if (!(await isKnownSlug(env, slug, now))) return text("Unknown flow", 404);

  const day = new Date(now).toISOString().slice(0, 10);
  const key = await sha256Hex(`${env.SALT || ""}|${day}|${address}|${slug}`);
  const seen = await env.DB.prepare("INSERT OR IGNORE INTO seen (key, day) VALUES (?, ?)")
    .bind(key, day)
    .run();
  if (seen.meta.changes === 1) {
    await env.DB.prepare(
      "INSERT INTO installs (slug, count) VALUES (?, 1) " +
        "ON CONFLICT(slug) DO UPDATE SET count = count + 1",
    )
      .bind(slug)
      .run();
  }
  // Yesterday's hashes have done their job.
  await env.DB.prepare("DELETE FROM seen WHERE day < ?").bind(day).run();
  return new Response(null, { status: 204 });
}

export async function handle(request, env, now, ctx) {
  const url = new URL(request.url);
  const key = url.pathname.replace(/^\/+/, "");
  if (request.method === "POST" && key === "v1/installs") {
    return countInstall(env, request, now);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return text("Method not allowed", 405);
  }
  if (key === "v1/installs.json") {
    return throughCache(request, ctx, () => installCounts(env));
  }
  if (key === INDEX || FLOW.test(key)) {
    return throughCache(request, ctx, () => serveObject(env, key, request));
  }
  return text("Not found", 404);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, undefined, ctx);
    } catch (error) {
      console.error(error);
      return text("Something went wrong", 500);
    }
  },
};

// For the tests: forget the slugs kept from an earlier index.
export function forgetIndex() {
  known = { slugs: null, at: 0 };
}
