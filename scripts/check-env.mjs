// Run with: npm run check   (reads .env). Verifies configuration and live connections. Sends no emails, charges nothing.
const env = process.env;
let fails = 0;
const ok = (m) => console.log("  ✓", m);
const bad = (m) => { fails++; console.log("  ✗", m); };
const warn = (m) => console.log("  !", m);
const get = (url, headers = {}) => fetch(url, { headers, signal: AbortSignal.timeout(8000) });
const section = (t) => console.log("\n" + t);

section("Required settings");
for (const k of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY"]) env[k] ? ok(k + " is set") : bad(k + " is missing");

if (env.SUPABASE_ANON_KEY) {
  let role = "";
  try { role = JSON.parse(Buffer.from(env.SUPABASE_ANON_KEY.split(".")[1], "base64url").toString()).role; } catch {}
  if (env.SUPABASE_ANON_KEY.startsWith("sb_secret_") || role === "service_role") bad("SUPABASE_ANON_KEY holds a SECRET key. It is sent to every browser. Use the publishable/anon key.");
  else ok("SUPABASE_ANON_KEY is a public key");
}

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
  section("Supabase");
  const h = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY };
  try {
    for (const t of ["products", "orders", "order_items"]) {
      const r = await get(`${env.SUPABASE_URL}/rest/v1/${t}?select=id&limit=1`, h);
      r.ok ? ok(`table ${t} exists`) : bad(`table ${t}: HTTP ${r.status}. Run the baseline migration.`);
    }
    const c = await get(`${env.SUPABASE_URL}/rest/v1/products?select=id,brand,specs,images,stock,active`, h);
    if (c.ok) ok(`products has the expected columns (${(await c.json()).length} products)`); else bad("products is missing columns. Run the baseline migration.");
    const b = await get(`${env.SUPABASE_URL}/storage/v1/bucket/product-images`, h);
    b.ok ? ok("storage bucket product-images exists") : bad("storage bucket product-images missing. Run the baseline migration.");
  } catch (e) { bad("could not reach Supabase: " + e.message); }
}

section("Mailgun (optional)");
if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN && env.MAILGUN_FROM) {
  try {
    const r = await get(`${env.MAILGUN_BASE || "https://api.mailgun.net"}/v3/domains/${env.MAILGUN_DOMAIN}`, { Authorization: "Basic " + Buffer.from("api:" + env.MAILGUN_API_KEY).toString("base64") });
    r.ok ? ok("key and domain accepted") : bad(`Mailgun answered HTTP ${r.status} (401 = wrong key or region, 404 = wrong domain)`);
  } catch (e) { bad("could not reach Mailgun: " + e.message); }
  if (!env.MAILGUN_FROM.includes(env.MAILGUN_DOMAIN)) warn("MAILGUN_FROM should use the same domain as MAILGUN_DOMAIN");
} else warn("not fully configured; confirmation emails will fail (orders still save)");

section("Paystack (optional)");
if (env.PAYSTACK_SECRET_KEY) {
  if (env.PAYSTACK_SECRET_KEY.startsWith("sk_live_")) warn("this is a LIVE key. Use sk_test_ while developing");
  try {
    const r = await get("https://api.paystack.co/balance", { Authorization: "Bearer " + env.PAYSTACK_SECRET_KEY });
    r.ok ? ok("secret key accepted") : bad(`Paystack answered HTTP ${r.status}`);
  } catch (e) { bad("could not reach Paystack: " + e.message); }
} else warn("no key; only pay on delivery is offered");

section("Other");
env.ADMIN_EMAILS ? ok("ADMIN_EMAILS is set") : warn("ADMIN_EMAILS is empty; nobody can open the admin page");
env.SITE_URL ? ok("SITE_URL = " + env.SITE_URL) : warn("SITE_URL not set (defaults to http://localhost:3000)");

console.log(fails ? `\n${fails} problem(s) found.` : "\nAll required checks passed.");
process.exit(fails ? 1 : 0);
