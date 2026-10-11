// Smoke tests that need no database or internet: run with `npm test`.
import test, { after } from "node:test";
import assert from "node:assert/strict";

Object.assign(process.env, { NODE_ENV: "test", SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_ANON_KEY: "anon-test", SUPABASE_SERVICE_KEY: "service-test-secret" });
delete process.env.PAYSTACK_SECRET_KEY;

const { default: app } = await import("../server.js");
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test("config exposes only public values", async () => {
  const body = await (await fetch(base + "/api/config")).text();
  assert.ok(!body.includes("service-test-secret"), "service key must never be sent to the browser");
  assert.deepEqual(Object.keys(JSON.parse(body)).sort(), ["anonKey", "paystack", "url"]);
  assert.equal(JSON.parse(body).paystack, false);
});

for (const [method, path] of [["GET", "/api/orders"], ["POST", "/api/orders"], ["GET", "/api/me"], ["GET", "/api/admin/products"], ["POST", "/api/admin/products"], ["GET", "/api/admin/orders"], ["POST", "/api/admin/upload"]]) {
  test(`${method} ${path} requires sign-in`, async () => {
    assert.equal((await fetch(base + path, { method })).status, 401);
  });
}

test("unknown API routes return JSON 404, not the web page", async () => {
  const r = await fetch(base + "/api/does-not-exist");
  assert.equal(r.status, 404);
  assert.equal((await r.json()).code, "not_found");
});

test("health check works", async () => {
  assert.deepEqual(await (await fetch(base + "/api/health")).json(), { ok: true });
});

test("responses carry security headers and a request id; no x-powered-by", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.ok(r.headers.get("content-security-policy-report-only"));
  assert.ok(r.headers.get("x-request-id"));
  assert.equal(r.headers.get("x-powered-by"), null);
});

test("malformed JSON gets a clean 400", async () => {
  const r = await fetch(base + "/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad" });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, "Invalid request body.");
});
