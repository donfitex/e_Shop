import { useEffect, useState } from "react";
import { useStore } from "../store.jsx";
import { btn } from "../ui.jsx";
import { money } from "../lib.js";

export const STATUS = { awaiting_payment: ["Awaiting payment", "bg-blink/60"], paid: ["Paid", "bg-leaf"], pending: ["Pay on delivery", "bg-leaf"] };

export default function Orders() {
  const { session, ready, api, signIn } = useStore();
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (session) api("orders").then(setOrders).catch((e) => setErr(e.message)); }, [session?.access_token]);

  return (
    <div className="py-6 md:max-w-2xl">
      <h1 className="text-3xl font-bold">My orders</h1>
      {ready && !session && <div className="mt-4 rounded-3xl border border-line bg-white p-5"><p className="mb-3">Sign in to see your orders.</p><button className={btn} onClick={signIn}>Sign in with Google</button></div>}
      {err && <p className="mt-4 text-alert">{err}</p>}
      {session && !orders && !err && <div className="mt-4 h-24 animate-pulse rounded-3xl bg-white" />}
      {orders?.length === 0 && <p className="mt-4 text-moss">No orders yet.</p>}
      <ul className="mt-4 space-y-3">
        {orders?.map((o) => {
          const [label, tone] = STATUS[o.status] || [o.status, "bg-leaf"];
          return (
            <li key={o.id} className="rounded-3xl border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <b>{new Date(o.created_at).toLocaleDateString()} · {money(o.total_cents)}</b>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label}</span>
              </div>
              <p className="mt-1 text-sm text-moss">{o.order_items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
