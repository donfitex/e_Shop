import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./server/errors.js";
import { isUuid, parseCheckout, parseProduct } from "./server/validate.js";
import { createLimiter } from "./server/ratelimit.js";
import { corsMiddleware, securityHeaders } from "./server/security.js";
import { log, requestLogger } from "./server/log.js";

const env = process.env;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const SITE = env.SITE_URL || "http://localhost:3000";
const IMAGE_PREFIX = `${(env.SUPABASE_URL || "").replace(/\/+$/, "")}/storage/v1/object/public/product-images/`;

const app = express();
// Express 4 ignores errors thrown inside async handlers (the process can crash). Forward them to the error middleware.
for (const m of ["get", "post", "put", "delete"]) {
  const orig = app[m].bind(app);
  app[m] = (...args) => orig(...args.map((a) => (typeof a === "function" && a.constructor.name === "AsyncFunction" ? (req, res, next) => a(req, res, next).catch(next) : a)));
}
app.disable("x-powered-by");
app.set("trust proxy", 1); // one proxy hop (Render) so req.ip is the real visitor
app.use(requestLogger());
app.use(securityHeaders({ production: env.NODE_ENV === "production", supabaseUrl: env.SUPABASE_URL, enforceCsp: env.CSP_ENFORCE === "true" }));
app.use("/api", corsMiddleware(env.CORS_ORIGINS));
app.use("/api", createLimiter({ windowMs: 60_000, max: 300 }));
app.use(express.json({ limit: "100kb" }));
app.use(express.static("dist"));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const money = (c) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(c / 100);

// One error format everywhere: { error, code } (+ requestId for server faults). Internal details are logged, never sent.
const fail = (res, e, code = 500) => {
  const status = e instanceof HttpError ? e.status : code;
  const message = e?.message || String(e);
  const show = e instanceof HttpError ? e.expose : status < 500;
  if (!show) log("error", "request failed", { requestId: res.req?.id, status, message });
  res.status(status).json(show
    ? { error: message, code: e?.code || "error" }
    : { error: "Something went wrong on our side. Please try again.", code: "server_error", requestId: res.req?.id });
};
const perUser = (max) => createLimiter({ windowMs: 60_000, max, key: (r) => r.user?.id || r.ip });

app.get("/api/health", (_, res) => res.json({ ok: true }));
app.get("/api/config", (_, res) => res.json({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, paystack: !!env.PAYSTACK_SECRET_KEY }));

app.get("/api/products", async (_, res) => {
  const { data, error } = await db.from("products").select("*").eq("active", true).order("name");
  error ? fail(res, error) : res.json(data);
});

async function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const { data } = await db.auth.getUser(token);
  if (!data?.user) return res.status(401).json({ error: "Sign in with Google to continue.", code: "unauthorized" });
  req.user = data.user;
  next();
}

app.get("/api/orders", auth, async (req, res) => {
  const { data, error } = await db.from("orders").select("*, order_items(*)").eq("user_id", req.user.id).order("created_at", { ascending: false });
  error ? fail(res, error) : res.json(data);
});

async function sendConfirmation(order, lines) {
  const rows = lines.map((l) => `<tr><td>${esc(l.name)} × ${l.qty}</td><td align="right">${money(l.unit_cents * l.qty)}</td></tr>`).join("");
  const s = order.shipping;
  const pay = order.status === "paid" ? "Paid online" : "Pay on delivery";
  const html = `<h2>R-Blink</h2><h3>Thanks, ${esc(s.name)} — order received</h3>
    <table cellpadding="6">${rows}<tr><td><b>Total</b></td><td align="right"><b>${money(order.total_cents)}</b></td></tr></table>
    <p>Payment: ${pay}</p><p>Shipping to:<br>${esc(s.name)}<br>${esc(s.address)}<br>${esc(s.city)}</p><p>Order reference: ${order.id}</p>`;
  const body = new URLSearchParams({ from: env.MAILGUN_FROM, to: order.email, subject: `R-Blink: order confirmed (#${order.id.slice(0, 8)})`, html });
  const r = await fetch(`${env.MAILGUN_BASE || "https://api.mailgun.net"}/v3/${env.MAILGUN_DOMAIN}/messages`, {
    method: "POST", headers: { Authorization: "Basic " + Buffer.from("api:" + env.MAILGUN_API_KEY).toString("base64") }, body,
  });
  if (!r.ok) throw new Error(`Mailgun ${r.status}: ${await r.text()}`);
}

// Reduce stock, mark the order, send the confirmation email.
async function finalize(order, lines, status) {
  for (const l of lines) await db.rpc("decrement_stock", { pid: l.product_id, qty: l.qty });
  await db.from("orders").update({ status }).eq("id", order.id);
  order.status = status;
  try { await sendConfirmation(order, lines); await db.from("orders").update({ email_sent: true }).eq("id", order.id); return true; }
  catch (e) { log("error", "confirmation email failed", { orderId: order.id, message: e.message }); return false; }
}

const paystack = async (p, opts = {}) => {
  const r = await fetch("https://api.paystack.co" + p, { ...opts, headers: { Authorization: "Bearer " + env.PAYSTACK_SECRET_KEY, "Content-Type": "application/json" } });
  return r.json();
};

app.post("/api/orders", auth, perUser(10), async (req, res) => {
  const { items, shipping, method } = parseCheckout(req.body);
  const online = method === "paystack";
  if (online && !env.PAYSTACK_SECRET_KEY) return fail(res, new HttpError(400, "Online payment isn't available right now.", "payment_unavailable"));

  const { data: products, error: pe } = await db.from("products").select("*").eq("active", true).in("id", items.map((i) => i.id));
  if (pe) return fail(res, pe);
  const lines = [];
  for (const i of items) {
    const p = products.find((x) => x.id === i.id);
    if (!p) return fail(res, new HttpError(400, "A phone in your cart is no longer available.", "unavailable"));
    if (p.stock < i.qty) return fail(res, new HttpError(400, p.stock ? `Only ${p.stock} of ${p.name} left.` : `${p.name} is sold out.`, "out_of_stock"));
    lines.push({ product_id: p.id, name: p.name, unit_cents: p.price_cents, qty: i.qty });
  }
  const total = lines.reduce((t, l) => t + l.unit_cents * l.qty, 0);

  const { data: order, error: oe } = await db.from("orders").insert({
    user_id: req.user.id, email: req.user.email, shipping, total_cents: total,
    payment_method: online ? "paystack" : "cod", status: online ? "awaiting_payment" : "pending",
  }).select().single();
  if (oe) return fail(res, oe);
  const { error: ie } = await db.from("order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (ie) return fail(res, ie);

  if (!online) return res.json({ id: order.id, emailSent: await finalize(order, lines, "pending") });
  try {
    const j = await paystack("/transaction/initialize", { method: "POST", body: JSON.stringify({ email: order.email, amount: total, currency: "NGN", reference: order.id, callback_url: SITE + "/" }) });
    if (!j.status) throw new Error(j.message);
    res.json({ id: order.id, url: j.data.authorization_url });
  } catch (e) {
    log("error", "paystack initialize failed", { requestId: req.id, message: e.message });
    await db.from("orders").delete().eq("id", order.id);
    fail(res, new HttpError(502, "Could not start the payment. Please try again.", "payment_unavailable", true));
  }
});

app.get("/api/orders/verify", auth, perUser(30), async (req, res) => {
  const ref = String(req.query.reference || "");
  if (!isUuid(ref)) throw new HttpError(400, "Invalid payment reference.", "validation_error");
  const { data: order } = await db.from("orders").select("*, order_items(*)").eq("id", ref).eq("user_id", req.user.id).maybeSingle();
  if (!order) return fail(res, new HttpError(404, "Order not found.", "not_found"));
  if (order.status !== "awaiting_payment") return res.json({ status: order.status, emailSent: order.email_sent });
  const j = await paystack("/transaction/verify/" + encodeURIComponent(ref));
  if (!j.status || j.data.status !== "success" || j.data.amount !== order.total_cents) return res.json({ status: "awaiting_payment", emailSent: false });
  // Claim the order so a double visit can't finalize it twice.
  const { data: claim } = await db.from("orders").update({ status: "paid" }).eq("id", ref).eq("status", "awaiting_payment").select().maybeSingle();
  if (!claim) return res.json({ status: "paid", emailSent: order.email_sent });
  const lines = order.order_items.map((i) => ({ product_id: i.product_id, name: i.name, unit_cents: i.unit_cents, qty: i.qty }));
  res.json({ status: "paid", emailSent: await finalize({ ...order, status: "paid" }, lines, "paid") });
});

// ---- Admin
const admins = (env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const isAdmin = (u) => admins.includes((u.email || "").toLowerCase());
const adminOnly = (req, res, next) => (isAdmin(req.user) ? next() : fail(res, new HttpError(403, "Admins only.", "forbidden")));
const productId = (req) => { if (!isUuid(req.params.id)) throw new HttpError(400, "Invalid product id.", "validation_error"); return req.params.id; };
app.get("/api/me", auth, (req, res) => res.json({ email: req.user.email, isAdmin: isAdmin(req.user) }));

app.get("/api/admin/products", auth, adminOnly, async (_, res) => {
  const { data, error } = await db.from("products").select("*").order("name");
  error ? fail(res, error) : res.json(data);
});
app.post("/api/admin/products", auth, adminOnly, async (req, res) => {
  const p = parseProduct(req.body, IMAGE_PREFIX);
  const { data, error } = await db.from("products").insert(p).select().single();
  error ? fail(res, error) : res.json(data);
});
app.put("/api/admin/products/:id", auth, adminOnly, async (req, res) => {
  const id = productId(req), p = parseProduct(req.body, IMAGE_PREFIX);
  const { data, error } = await db.from("products").update(p).eq("id", id).select().single();
  error ? fail(res, error) : res.json(data);
});
app.delete("/api/admin/products/:id", auth, adminOnly, async (req, res) => {
  const { error } = await db.from("products").delete().eq("id", productId(req));
  error ? fail(res, new HttpError(409, "This phone has orders, so it can't be deleted. Hide it instead.", "has_orders")) : res.json({ ok: true });
});
app.get("/api/admin/orders", auth, adminOnly, async (_, res) => {
  const { data, error } = await db.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(100);
  error ? fail(res, error) : res.json(data);
});

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
app.post("/api/admin/upload", auth, adminOnly, perUser(30), express.raw({ type: Object.keys(EXT), limit: "6mb" }), async (req, res) => {
  const type = req.headers["content-type"];
  if (!EXT[type] || !Buffer.isBuffer(req.body) || !req.body.length) return fail(res, new HttpError(400, "Choose a JPG, PNG or WebP image under 6 MB.", "validation_error"));
  const file = `${randomUUID()}.${EXT[type]}`;
  const { error } = await db.storage.from("product-images").upload(file, req.body, { contentType: type });
  if (error) return fail(res, error);
  res.json({ url: db.storage.from("product-images").getPublicUrl(file).data.publicUrl });
});

app.use("/api", (_req, res) => fail(res, new HttpError(404, "Not found.", "not_found")));
// React app: any non-API route returns index.html
app.get("*", (req, res) => res.sendFile(path.resolve("dist", "index.html"), (e) => e && res.status(503).send("Run `npm run build` first.")));

app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return fail(res, new HttpError(400, "Invalid request body.", "validation_error"));
  if (err.status === 413) return fail(res, new HttpError(413, "That file is too large (6 MB maximum).", "too_large"));
  fail(res, err, err.status && err.status < 500 ? err.status : 500);
});

export default app;
if (env.NODE_ENV !== "test") app.listen(env.PORT || 3000, () => log("info", "R-Blink running", { url: "http://localhost:" + (env.PORT || 3000) }));
