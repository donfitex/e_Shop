import { useEffect, useState } from "react";
import { ImagePlus, Pencil, Eye, EyeOff, Trash2, X } from "lucide-react";
import { useStore } from "../store.jsx";
import { Cover, btn, btnGhost, input } from "../ui.jsx";
import { money } from "../lib.js";
import { STATUS } from "./Orders.jsx";

const EMPTY = { name: "", brand: "", price: "", stock: 10, specs: "", description: "", color: "#22352d", active: true };

export default function Admin() {
  const { session, ready, isAdmin, api, signIn, refreshProducts } = useStore();
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [imgs, setImgs] = useState([]);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setItems(await api("admin/products")); setOrders(await api("admin/orders")); }
    catch (e) { setMsg({ err: true, t: e.message }); }
  };
  useEffect(() => { if (isAdmin === true) load(); }, [isAdmin]);

  if (!ready || (session && isAdmin === null)) return <div className="mt-6 h-40 animate-pulse rounded-3xl bg-white" />;
  if (!session) return <div className="py-10"><p className="mb-3">Sign in with an admin Google account.</p><button className={btn} onClick={signIn}>Sign in with Google</button></div>;
  if (!isAdmin) return <p className="mt-6 rounded-2xl bg-alert/10 p-4 text-alert">This account isn't an admin. Add its email to ADMIN_EMAILS in the server settings and restart.</p>;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const reset = () => { setEditId(null); setF(EMPTY); setImgs([]); };
  const flash = (t, err) => setMsg({ t, err });

  const upload = async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    for (const file of files) {
      flash(`Uploading ${file.name}…`);
      try {
        const r = await fetch("/api/admin/upload", { method: "POST", headers: { "Content-Type": file.type, Authorization: "Bearer " + session.access_token }, body: file });
        const j = await r.json(); if (!r.ok) throw new Error(j.error);
        setImgs((x) => (x.length < 8 ? [...x, j.url] : x)); setMsg(null);
      } catch (x) { flash(`${file.name}: ${x.message}`, true); }
    }
  };
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api("admin/products" + (editId ? "/" + editId : ""), { method: editId ? "PUT" : "POST", body: JSON.stringify({ ...f, images: imgs }) });
      flash(editId ? "Phone updated." : "Phone added."); reset(); await load(); refreshProducts();
    } catch (x) { flash(x.message, true); }
    setBusy(false);
  };
  const edit = (p) => {
    setEditId(p.id); setImgs(p.images || []);
    setF({ name: p.name, brand: p.brand, price: p.price_cents / 100, stock: p.stock, specs: p.specs, description: p.description, color: p.color, active: p.active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggle = async (p) => {
    try { await api("admin/products/" + p.id, { method: "PUT", body: JSON.stringify({ ...p, price: p.price_cents / 100, active: !p.active }) }); await load(); refreshProducts(); }
    catch (x) { flash(x.message, true); }
  };
  const del = async (p) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    try { await api("admin/products/" + p.id, { method: "DELETE" }); flash("Deleted."); await load(); refreshProducts(); }
    catch (x) { flash(x.message, true); }
  };

  return (
    <div className="space-y-8 py-6">
      <h1 className="text-3xl font-bold">Admin</h1>
      {msg && <div role="status" className={`rounded-2xl p-3 ${msg.err ? "bg-alert/10 text-alert" : "bg-leaf"}`}>{msg.t}</div>}

      <form onSubmit={save} className="grid gap-4 rounded-3xl border border-line bg-white p-5 sm:grid-cols-2">
        <h2 className="text-xl font-bold sm:col-span-2">{editId ? `Edit ${f.name}` : "Add a phone"}</h2>
        <label className="text-sm">Name<input className={input} required value={f.name} onChange={set("name")} placeholder="iPhone 15" /></label>
        <label className="text-sm">Brand<input className={input} value={f.brand} onChange={set("brand")} placeholder="Apple" /></label>
        <label className="text-sm">Price (₦)<input className={input} type="number" min="0" step="0.01" required value={f.price} onChange={set("price")} /></label>
        <label className="text-sm">Stock (units)<input className={input} type="number" min="0" step="1" required value={f.stock} onChange={set("stock")} /></label>
        <label className="text-sm sm:col-span-2">Specs, separated by “·”<input className={input} value={f.specs} onChange={set("specs")} placeholder={'6.1" · 128GB · 6GB RAM'} /></label>
        <label className="text-sm sm:col-span-2">Description<textarea className={input} rows={3} value={f.description} onChange={set("description")} /></label>
        <div className="sm:col-span-2">
          <span className="mb-2 block text-sm">Photos: front, back, side… (JPG, PNG or WebP, up to 8, 6 MB each). The first is the main photo.</span>
          <div className="flex flex-wrap gap-3">
            {imgs.map((u, i) => (
              <div key={u} className="w-28 text-center text-xs">
                <img src={u} alt={`Photo ${i + 1}`} className="size-28 rounded-2xl border border-line bg-mist object-contain" />
                <div className="mt-1 flex justify-center gap-1">
                  {i === 0 ? <b>Main</b> : <button type="button" className="underline" onClick={() => setImgs([u, ...imgs.filter((x) => x !== u)])}>Make main</button>}
                  <button type="button" aria-label="Remove photo" onClick={() => setImgs(imgs.filter((x) => x !== u))}><X className="size-4" /></button>
                </div>
              </div>
            ))}
            <label className="grid size-28 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line text-moss hover:bg-leaf">
              <span className="grid place-items-center gap-1 text-xs"><ImagePlus className="size-6" />Add photos</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={upload} />
            </label>
          </div>
        </div>
        <label className="text-sm">Colour (shown when there are no photos)<input type="color" className="h-11 w-full rounded-xl border border-line bg-white p-1" value={f.color} onChange={set("color")} /></label>
        <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" className="size-5" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Show in shop</label>
        <div className="flex gap-3 sm:col-span-2">
          <button className={btn} disabled={busy}>{busy ? "Saving…" : "Save phone"}</button>
          {editId && <button type="button" className={btnGhost} onClick={reset}>Cancel edit</button>}
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-xl font-bold">Phones</h2>
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-white p-3">
              <Cover p={p} className="size-16 rounded-xl" phone="h-10" />
              <div className="min-w-40 flex-1">
                <b>{p.name}</b> <span className="text-sm text-moss">{p.brand}</span>
                <div className="text-sm text-moss">{money(p.price_cents)} · {p.stock} in stock · {(p.images || []).length} photo(s) · {p.active ? "Shown" : "Hidden"}</div>
              </div>
              <div className="flex gap-2">
                <button className={`${btnGhost} px-3! py-2!`} onClick={() => edit(p)} aria-label={`Edit ${p.name}`}><Pencil className="size-4" /></button>
                <button className={`${btnGhost} px-3! py-2!`} onClick={() => toggle(p)} aria-label={p.active ? `Hide ${p.name}` : `Show ${p.name}`}>{p.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                <button className={`${btnGhost} px-3! py-2!`} onClick={() => del(p)} aria-label={`Delete ${p.name}`}><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Recent orders</h2>
        {!orders.length && <p className="text-moss">No orders yet.</p>}
        <ul className="space-y-3">
          {orders.map((o) => {
            const [label, tone] = STATUS[o.status] || [o.status, "bg-leaf"];
            return (
              <li key={o.id} className="rounded-3xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>{new Date(o.created_at).toLocaleString()} · {money(o.total_cents)}</b>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label}</span>
                </div>
                <p className="mt-1 text-sm">{o.order_items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
                <p className="text-sm text-moss">{o.shipping.name} · {o.email} · {o.shipping.address}, {o.shipping.city}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
