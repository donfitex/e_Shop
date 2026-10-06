import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const SITE = env.SITE_URL || "http://localhost:3000";
const app = express();
app.use(express.json());
app.use(express.static("dist"));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const money = (c) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(c / 100);
const fail = (res, e, code = 500) => res.status(code).json({ error: e.message || e });

app.get("/api/config", (_, res) => res.json({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, paystack: !!env.PAYSTACK_SECRET_KEY }));

app.get("/api/products", async (_, res) => {
  const { data, error } = await db.from("products").select("*").eq("active", true).order("name");
  error ? fail(res, error) : res.json(data);
});

async function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const { data } = await db.auth.getUser(token);
  if (!data?.user) return res.status(401).json({ error: "Sign in with Google to continue." });
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
  catch (e) { console.error("Confirmation email failed:", e.message); return false; }
}

const paystack = async (path, opts = {}) => {
  const r = await fetch("https://api.paystack.co" + path, { ...opts, headers: { Authorization: "Bearer " + env.PAYSTACK_SECRET_KEY, "Content-Type": "application/json" } });
  return r.json();
};

app.post("/api/orders", auth, async (req, res) => {
  const { items, shipping, method } = req.body || {};
  if (!Array.isArray(items) || !items.length) return fail(res, "Your cart is empty.", 400);
  if (!shipping?.name || !shipping?.address || !shipping?.city) return fail(res, "Fill in name, address and city.", 400);
  const online = method === "paystack";
  if (online && !env.PAYSTACK_SECRET_KEY) return fail(res, "Online payment isn't available right now.", 400);

  const { data: products, error: pe } = await db.from("products").select("*").eq("active", true).in("id", items.map((i) => i.id));
  if (pe) return fail(res, pe);
  const lines = [];
  for (const i of items) {
    const p = products.find((x) => x.id === i.id);
    const qty = Math.min(Math.max(parseInt(i.qty) || 0, 1), 20);
    if (!p) return fail(res, "A phone in your cart is no longer available.", 400);
    if (p.stock < qty) return fail(res, p.stock ? `Only ${p.stock} of ${p.name} left.` : `${p.name} is sold out.`, 400);
    lines.push({ product_id: p.id, name: p.name, unit_cents: p.price_cents, qty });
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
    await db.from("orders").delete().eq("id", order.id);
    fail(res, "Could not start payment: " + e.message, 502);
  }
});

app.get("/api/orders/verify", auth, async (req, res) => {
  const ref = String(req.query.reference || "");
  const { data: order } = await db.from("orders").select("*, order_items(*)").eq("id", ref).eq("user_id", req.user.id).maybeSingle();
  if (!order) return fail(res, "Order not found.", 404);
  if (order.status !== "awaiting_payment") return res.json({ status: order.status, emailSent: order.email_sent });
  try {
    const j = await paystack("/transaction/verify/" + encodeURIComponent(ref));
    if (!j.status || j.data.status !== "success" || j.data.amount !== order.total_cents) return res.json({ status: "awaiting_payment", emailSent: false });
    // Claim the order so a double visit can't finalize it twice.
    const { data: claim } = await db.from("orders").update({ status: "paid" }).eq("id", ref).eq("status", "awaiting_payment").select().maybeSingle();
    if (!claim) return res.json({ status: "paid", emailSent: order.email_sent });
    const lines = order.order_items.map((i) => ({ product_id: i.product_id, name: i.name, unit_cents: i.unit_cents, qty: i.qty }));
    res.json({ status: "paid", emailSent: await finalize({ ...order, status: "paid" }, lines, "paid") });
  } catch (e) { fail(res, e, 502); }
});

// ---- Admin
const admins = (env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const isAdmin = (u) => admins.includes((u.email || "").toLowerCase());
const adminOnly = (req, res, next) => (isAdmin(req.user) ? next() : fail(res, "Admins only.", 403));
app.get("/api/me", auth, (req, res) => res.json({ email: req.user.email, isAdmin: isAdmin(req.user) }));

const cleanProduct = (b) => ({
  name: String(b.name || "").trim(), brand: String(b.brand || "").trim(), specs: String(b.specs || "").trim(),
  description: String(b.description || "").trim(), color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#2F3B4C",
  images: (Array.isArray(b.images) ? b.images : []).filter((u) => /^https?:\/\//.test(u)).slice(0, 8),
  stock: Math.max(0, parseInt(b.stock) || 0), active: b.active !== false, price_cents: Math.round(Number(b.price) * 100),
});
const invalid = (p) => (!p.name ? "Name is required." : !Number.isFinite(p.price_cents) || p.price_cents < 0 ? "Enter a valid price." : null);

app.get("/api/admin/products", auth, adminOnly, async (_, res) => {
  const { data, error } = await db.from("products").select("*").order("name");
  error ? fail(res, error) : res.json(data);
});
app.post("/api/admin/products", auth, adminOnly, async (req, res) => {
  const p = cleanProduct(req.body || {}); const bad = invalid(p); if (bad) return fail(res, bad, 400);
  const { data, error } = await db.from("products").insert(p).select().single();
  error ? fail(res, error) : res.json(data);
});
app.put("/api/admin/products/:id", auth, adminOnly, async (req, res) => {
  const p = cleanProduct(req.body || {}); const bad = invalid(p); if (bad) return fail(res, bad, 400);
  const { data, error } = await db.from("products").update(p).eq("id", req.params.id).select().single();
  error ? fail(res, error) : res.json(data);
});
app.delete("/api/admin/products/:id", auth, adminOnly, async (req, res) => {
  const { error } = await db.from("products").delete().eq("id", req.params.id);
  error ? fail(res, "This phone has orders, so it can't be deleted. Hide it instead.", 409) : res.json({ ok: true });
});
app.get("/api/admin/orders", auth, adminOnly, async (_, res) => {
  const { data, error } = await db.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(100);
  error ? fail(res, error) : res.json(data);
});

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
app.post("/api/admin/upload", auth, adminOnly, express.raw({ type: Object.keys(EXT), limit: "6mb" }), async (req, res) => {
  const type = req.headers["content-type"];
  if (!EXT[type] || !Buffer.isBuffer(req.body) || !req.body.length) return fail(res, "Choose a JPG, PNG or WebP image under 6 MB.", 400);
  const file = `${randomUUID()}.${EXT[type]}`;
  const { error } = await db.storage.from("product-images").upload(file, req.body, { contentType: type });
  if (error) return fail(res, error);
  res.json({ url: db.storage.from("product-images").getPublicUrl(file).data.publicUrl });
});

// React app: any non-API route returns index.html
app.get("*", (req, res, next) => req.path.startsWith("/api/") ? next() : res.sendFile(path.resolve("dist", "index.html"), (e) => e && res.status(503).send("Run `npm run build` first.")));

app.use((err, _req, res, _next) => fail(res, err.status === 413 ? "Image is larger than 6 MB." : "Server error", err.status || 500));
app.listen(env.PORT || 3000, () => console.log("R-Blink running on http://localhost:" + (env.PORT || 3000)));
