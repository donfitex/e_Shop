import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CreditCard, Trash2, Truck } from "lucide-react";
import { useStore } from "../store.jsx";
import { Cover, Stepper, btn, input } from "../ui.jsx";
import { money } from "../lib.js";

const Empty = () => (
  <div className="py-16 text-center"><h1 className="text-2xl font-bold">Your cart is empty</h1><Link to="/" className="mt-2 inline-block text-moss underline">Browse phones</Link></div>
);

export function Cart() {
  const { lines, total, add, dec, remove } = useStore();
  if (!lines.length) return <Empty />;
  return (
    <div className="py-6 md:max-w-2xl">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <ul className="mt-4 space-y-3">
        {lines.map(({ p, qty }) => (
          <li key={p.id} className="flex gap-4 rounded-3xl border border-line bg-white p-3">
            <Link to={`/p/${p.id}`} className="shrink-0"><Cover p={p} className="size-24 rounded-2xl" phone="h-16" /></Link>
            <div className="flex-1">
              <div className="flex justify-between gap-2">
                <Link to={`/p/${p.id}`} className="font-bold hover:underline">{p.name}</Link>
                <button onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} className="text-moss hover:text-alert"><Trash2 className="size-5" /></button>
              </div>
              <div className="text-sm text-moss">{money(p.price_cents)} each</div>
              <div className="mt-2 flex items-center justify-between">
                <Stepper value={qty} onDec={() => dec(p.id)} onInc={() => add(p.id)} />
                <b>{money(p.price_cents * qty)}</b>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between rounded-3xl bg-white p-4 text-lg"><span>Total</span><b className="text-2xl">{money(total)}</b></div>
      <Link to="/checkout" className={`${btn} mt-4 w-full`}>Go to checkout</Link>
    </div>
  );
}

export function Checkout() {
  const { lines, total, session, signIn, api, clear, cfg, refreshProducts } = useStore();
  const nav = useNavigate();
  const [ship, setShip] = useState({ name: "", address: "", city: "" });
  const [method, setMethod] = useState("cod");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (cfg?.paystack) setMethod("paystack"); }, [cfg]);

  if (!lines.length) return <Empty />;
  const set = (k) => (e) => setShip({ ...ship, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api("orders", { method: "POST", body: JSON.stringify({ items: lines.map((l) => ({ id: l.p.id, qty: l.qty })), shipping: ship, method }) });
      if (r.url) { location.href = r.url; return; }
      clear(); refreshProducts(); nav(`/done?pay=cod&mail=${r.emailSent ? 1 : 0}`);
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  const opt = (v, Icon, title, sub) => (
    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 ${method === v ? "border-ink bg-leaf" : "border-line bg-white"}`}>
      <input type="radio" name="pay" value={v} checked={method === v} onChange={() => setMethod(v)} className="sr-only" />
      <Icon className="size-6" /><span><b className="block">{title}</b><span className="text-sm text-moss">{sub}</span></span>
    </label>
  );
  return (
    <div className="grid gap-8 py-6 md:grid-cols-[1fr_340px]">
      <div>
        <h1 className="text-3xl font-bold">Checkout</h1>
        {!session ? (
          <div className="mt-4 rounded-3xl border border-line bg-white p-5">
            <p className="mb-3">Sign in so we can email your confirmation and keep your order history.</p>
            <button className={btn} onClick={signIn}>Sign in with Google</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block text-sm">Full name<input className={input} required autoComplete="name" value={ship.name} onChange={set("name")} /></label>
            <label className="block text-sm">Street address<input className={input} required autoComplete="street-address" value={ship.address} onChange={set("address")} /></label>
            <label className="block text-sm">City<input className={input} required autoComplete="address-level2" value={ship.city} onChange={set("city")} /></label>
            <fieldset className="space-y-3"><legend className="mb-2 font-bold">Payment</legend>
              {cfg?.paystack && opt("paystack", CreditCard, "Pay online", "Card or bank transfer via Paystack")}
              {opt("cod", Truck, "Pay on delivery", "Pay when your phone arrives")}
            </fieldset>
            <p className="text-sm text-moss">Confirmation goes to {session.user.email}.</p>
            {err && <div role="alert" className="rounded-xl bg-alert/10 p-3 text-alert">{err}</div>}
            <button className={`${btn} w-full`} disabled={busy}>{busy ? "Placing order…" : `Place order · ${money(total)}`}</button>
          </form>
        )}
      </div>
      <aside className="h-fit rounded-3xl border border-line bg-white p-4">
        <h2 className="mb-3 font-bold">Order summary</h2>
        {lines.map(({ p, qty }) => <div key={p.id} className="flex justify-between py-1 text-sm"><span>{p.name} × {qty}</span><span>{money(p.price_cents * qty)}</span></div>)}
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold"><span>Total</span><span>{money(total)}</span></div>
      </aside>
    </div>
  );
}

export function Done() {
  const [q] = useSearchParams();
  const pay = q.get("pay"), mail = q.get("mail") === "1";
  const failed = pay === "failed";
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-3xl font-bold">{failed ? "Payment not confirmed" : pay === "paid" ? "Payment received" : "Order placed"}</h1>
      <p className={`mt-3 rounded-2xl p-4 ${failed ? "bg-alert/10 text-alert" : "bg-leaf"}`}>
        {failed ? "We couldn't confirm your payment. If you were charged, check Orders in a minute or contact the shop."
          : `${pay === "paid" ? "Your order is confirmed." : "Pay when your phone is delivered."} ${mail ? "A confirmation email is on its way." : "We couldn't send the confirmation email, but your order is saved."}`}
      </p>
      <Link to="/" className={`${btn} mt-6`}>Keep shopping</Link>
    </div>
  );
}
