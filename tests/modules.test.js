// Unit tests for the pure backend modules. No network, no database.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { HttpError } from "../server/errors.js";
import { isUuid, parseCheckout, parseProduct, text } from "../server/validate.js";
import { createLimiter } from "../server/ratelimit.js";
import { buildCsp, corsMiddleware, securityHeaders } from "../server/security.js";
import { requestLogger } from "../server/log.js";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const ID2 = "223e4567-e89b-42d3-a456-426614174000";
const ship = { name: "Ada Obi", address: "12 Marina Road", city: "Lagos" };
const rejects = (fn, re) => assert.throws(fn, (e) => e instanceof HttpError && e.status === 400 && (!re || re.test(e.message)));

function fakeRes() {
  const res = new EventEmitter();
  res.headers = {}; res.statusCode = 200;
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}

test("isUuid", () => {
  assert.ok(isUuid(ID));
  for (const v of ["", "abc", null, undefined, 5, ID + "x"]) assert.equal(isUuid(v), false);
});

test("text trims, collapses spaces, enforces length", () => {
  assert.equal(text("  a   b ", { field: "X", max: 10 }), "a b");
  assert.equal(text("l1\nl2", { field: "X", max: 10, multiline: true }), "l1\nl2");
  rejects(() => text("", { field: "Name", min: 1, max: 5 }), /Name is required/);
  rejects(() => text("toolong", { field: "Name", max: 3 }), /at most 3/);
  rejects(() => text(42, { field: "Name", max: 3 }), /must be text/);
});

test("parseCheckout accepts a good order and merges duplicate items", () => {
  const r = parseCheckout({ items: [{ id: ID, qty: 1 }, { id: ID, qty: 2 }, { id: ID2, qty: "3" }], shipping: ship });
  assert.deepEqual(r.items, [{ id: ID, qty: 3 }, { id: ID2, qty: 3 }]);
  assert.equal(r.method, "cod");
  assert.equal(parseCheckout({ items: [{ id: ID, qty: 1 }], shipping: ship, method: "paystack" }).method, "paystack");
});

test("parseCheckout rejects bad input", () => {
  rejects(() => parseCheckout(undefined), /cart is empty/);
  rejects(() => parseCheckout({ items: [], shipping: ship }), /cart is empty/);
  rejects(() => parseCheckout({ items: [{ id: "x", qty: 1 }], shipping: ship }), /invalid/);
  for (const qty of [0, -1, 1.5, "a", null]) rejects(() => parseCheckout({ items: [{ id: ID, qty }], shipping: ship }), /Quantity/);
  rejects(() => parseCheckout({ items: [{ id: ID, qty: 15 }, { id: ID, qty: 6 }], shipping: ship }), /at most 20/);
  rejects(() => parseCheckout({ items: Array(51).fill({ id: ID, qty: 1 }), shipping: ship }), /Too many/);
  rejects(() => parseCheckout({ items: [{ id: ID, qty: 1 }], shipping: { ...ship, name: "" } }), /Name is required/);
  rejects(() => parseCheckout({ items: [{ id: ID, qty: 1 }], shipping: ship, method: "bitcoin" }), /payment method/);
});

const prefix = "https://abc.supabase.co/storage/v1/object/public/product-images/";
const good = { name: " Galaxy S24 ", price: "1250000", stock: 5, brand: "Samsung", specs: '6.2" · 256GB', description: "Line1\nLine2", color: "#7B6FA8", images: [prefix + "a.jpg"], active: true };

test("parseProduct accepts a good product and converts price to kobo", () => {
  const p = parseProduct(good, prefix);
  assert.equal(p.name, "Galaxy S24");
  assert.equal(p.price_cents, 125000000);
  assert.equal(p.description, "Line1\nLine2");
  assert.equal(parseProduct({ ...good, price: 19.99 }, prefix).price_cents, 1999);
  assert.equal(parseProduct({ ...good, color: "red", active: false }, prefix).color, "#2F3B4C");
});

test("parseProduct rejects bad input", () => {
  rejects(() => parseProduct({ ...good, name: "" }, prefix), /Name is required/);
  for (const price of ["", null, "abc", -1, 1e12]) rejects(() => parseProduct({ ...good, price }, prefix), /valid price/);
  for (const stock of [-1, 1.5, "x", 1e6]) rejects(() => parseProduct({ ...good, stock }, prefix), /Stock/);
  rejects(() => parseProduct({ ...good, images: ["https://evil.example/x.jpg"] }, prefix), /uploaded through/);
  rejects(() => parseProduct({ ...good, images: Array.from({ length: 9 }, (_, i) => prefix + i + ".jpg") }, prefix), /Up to 8/);
  rejects(() => parseProduct({ ...good, images: "nope" }, prefix), /list/);
});

test("rate limiter blocks after max, resets after the window, separates keys", () => {
  let t = 1000;
  const limit = createLimiter({ windowMs: 60000, max: 2, now: () => t, key: (r) => r.k });
  const hit = (k) => { const res = fakeRes(); let passed = false; limit({ k }, res, () => { passed = true; }); return { res, passed }; };
  assert.ok(hit("a").passed); assert.ok(hit("a").passed);
  const blocked = hit("a");
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.statusCode, 429);
  assert.equal(blocked.res.body.code, "rate_limited");
  assert.ok(Number(blocked.res.headers["Retry-After"]) > 0);
  assert.ok(hit("b").passed, "another key is unaffected");
  t += 60001;
  assert.ok(hit("a").passed, "window reset");
});

test("CSP allows only what the app needs", () => {
  const csp = buildCsp("https://abc.supabase.co");
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co/);
  assert.match(csp, /img-src 'self' data: blob: https:\/\/abc\.supabase\.co/);
  assert.ok(!csp.includes("unsafe-eval") && !/script-src[^;]*unsafe-inline/.test(csp));
});

test("security headers: report-only by default, HSTS only in production", () => {
  const run = (opts) => { const res = fakeRes(); securityHeaders(opts)({}, res, () => {}); return res.headers; };
  const dev = run({ supabaseUrl: "https://abc.supabase.co" });
  assert.equal(dev["X-Content-Type-Options"], "nosniff");
  assert.ok(dev["Content-Security-Policy-Report-Only"] && !dev["Content-Security-Policy"]);
  assert.ok(!dev["Strict-Transport-Security"]);
  const prod = run({ production: true, enforceCsp: true, supabaseUrl: "https://abc.supabase.co" });
  assert.ok(prod["Content-Security-Policy"] && prod["Strict-Transport-Security"]);
});

test("CORS: no headers unless the origin is listed", () => {
  const mw = corsMiddleware("https://shop.example, https://admin.example");
  const call = (origin, method = "GET") => { const res = fakeRes(); let next = false; mw({ headers: { origin }, method }, res, () => { next = true; }); return { res, next }; };
  assert.equal(call("https://evil.example").res.headers["Access-Control-Allow-Origin"], undefined);
  assert.equal(call("https://shop.example").res.headers["Access-Control-Allow-Origin"], "https://shop.example");
  const pre = call("https://shop.example", "OPTIONS");
  assert.equal(pre.res.statusCode, 204); assert.equal(pre.next, false);
  assert.equal(corsMiddleware("")({ headers: { origin: "https://x" }, method: "GET" }, fakeRes(), () => {}), undefined);
});

test("request logger sets an id and logs one safe line per API request", () => {
  const lines = [];
  const mw = requestLogger({ write: (l, m, extra) => lines.push(extra) });
  const res = fakeRes();
  mw({ path: "/api/orders", method: "POST", headers: { authorization: "Bearer SECRET" } }, res, () => {});
  assert.ok(res.headers["X-Request-Id"]);
  res.statusCode = 201; res.emit("finish");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].status, 201);
  assert.ok(!JSON.stringify(lines[0]).includes("SECRET"));
  const res2 = fakeRes(); mw({ path: "/assets/app.js", method: "GET", headers: {} }, res2, () => {}); res2.emit("finish");
  assert.equal(lines.length, 1, "static files are not logged");
});
