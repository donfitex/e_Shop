import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bookmark, ChevronLeft } from "lucide-react";
import { useStore } from "../store.jsx";
import { Cover, Stepper, StockBadge, btn, btnGhost } from "../ui.jsx";
import { money, parseSpecs } from "../lib.js";

export default function Product() {
  const { id } = useParams();
  const { products, loadingProducts, add, saved, toggleSaved } = useStore();
  const nav = useNavigate();
  const [view, setView] = useState(0);
  const [qty, setQty] = useState(1);
  const p = products.find((x) => x.id === id);

  if (loadingProducts) return <div className="mt-6 h-96 animate-pulse rounded-3xl bg-white" />;
  if (!p) return <div className="py-16 text-center"><h1 className="text-2xl font-bold">Phone not found</h1><Link to="/" className="text-moss underline">Back to the shop</Link></div>;

  const imgs = p.images || [];
  const on = saved.includes(p.id);
  return (
    <div className="py-5">
      <Link to="/" className="inline-flex items-center gap-1 text-moss hover:text-ink"><ChevronLeft className="size-5" />All phones</Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          <div className="relative overflow-hidden rounded-3xl border border-line">
            {imgs.length ? <img src={imgs[view]} alt={`${p.name}, view ${view + 1}`} className="aspect-square w-full bg-white object-contain" /> : <Cover p={p} className="aspect-square w-full" phone="h-64" />}
            <div className="absolute left-3 top-3"><StockBadge p={p} /></div>
          </div>
          {imgs.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
              {imgs.map((u, i) => (
                <button key={u} onClick={() => setView(i)} aria-label={`Show view ${i + 1}`} aria-current={i === view}
                        className={`size-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white ${i === view ? "border-ink" : "border-line"}`}>
                  <img src={u} alt="" className="size-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-moss">{p.brand}</div>
          <h1 className="text-4xl font-bold tracking-tight">{p.name}</h1>
          <p className="mt-3 text-3xl font-bold text-brand">{money(p.price_cents)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {parseSpecs(p.specs).map((s) => <span key={s} className="rounded-full bg-leaf px-4 py-2 text-sm font-medium">{s}</span>)}
          </div>
          <p className="mt-5 leading-relaxed text-ink/80">{p.description}</p>
          {p.stock > 0 ? (
            <div className="mt-6 space-y-4">
              <Stepper value={qty} onDec={() => setQty(Math.max(1, qty - 1))} onInc={() => setQty(Math.min(p.stock, qty + 1))} />
              <div className="flex flex-wrap gap-3">
                <button className={btn} onClick={() => add(p.id, qty)}>Add to cart</button>
                <button className={btnGhost} onClick={() => { add(p.id, qty); nav("/checkout"); }}>Buy now</button>
                <button onClick={() => toggleSaved(p.id)} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save"} className="grid size-12 place-items-center rounded-2xl border border-line bg-white">
                  <Bookmark className={`size-5 ${on ? "fill-ink" : ""}`} />
                </button>
              </div>
            </div>
          ) : <p className="mt-6 font-bold text-alert">This phone is sold out.</p>}
        </div>
      </div>
    </div>
  );
}
