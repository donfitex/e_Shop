import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Bookmark, Search, Sparkles, Zap } from "lucide-react";
import { useStore } from "../store.jsx";
import { Cover, StockBadge, btn } from "../ui.jsx";
import { money, parseSpecs } from "../lib.js";

const SORTS = { name: "Featured", low: "Price: low to high", high: "Price: high to low", stock: "In stock first" };

function Card({ p }) {
  const { saved, toggleSaved, add } = useStore();
  const on = saved.includes(p.id);
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="relative">
        <Link to={`/p/${p.id}`} aria-label={`View ${p.name}`}><Cover p={p} className="aspect-[4/3] w-full" /></Link>
        <div className="absolute left-3 top-3"><StockBadge p={p} /></div>
        <button onClick={() => toggleSaved(p.id)} aria-label={on ? "Remove from saved" : "Save"} aria-pressed={on}
                className="absolute right-3 top-3 grid size-12 place-items-center rounded-full bg-white shadow">
          <Bookmark className={`size-5 ${on ? "fill-ink" : ""}`} />
        </button>
      </div>
      <div className="p-4">
        <div className="text-sm text-moss">{p.brand}</div>
        <Link to={`/p/${p.id}`}><h3 className="text-xl font-bold hover:underline">{p.name}</h3></Link>
        <p className="mt-1 line-clamp-1 text-sm text-moss">{parseSpecs(p.specs).join(" · ") || p.description}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <b className="text-xl text-brand">{money(p.price_cents)}</b>
          <button className={btn} disabled={p.stock <= 0} onClick={() => add(p.id)}>{p.stock > 0 ? "Add to cart" : "Sold out"}</button>
        </div>
      </div>
    </article>
  );
}

export default function Home({ initialChip = "All" }) {
  const { products, loadingProducts, saved } = useStore();
  const [chip, setChip] = useState(initialChip);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [menu, setMenu] = useState(false);

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const l = products.filter((p) =>
      (chip === "All" || (chip === "Saved" ? saved.includes(p.id) : p.brand === chip)) &&
      `${p.name} ${p.brand} ${p.specs}`.toLowerCase().includes(needle));
    const by = { name: (a, b) => a.name.localeCompare(b.name), low: (a, b) => a.price_cents - b.price_cents, high: (a, b) => b.price_cents - a.price_cents, stock: (a, b) => (b.stock > 0) - (a.stock > 0) };
    return [...l].sort(by[sort]);
  }, [products, chip, q, sort, saved]);

  return (
    <>
      <section className="-mx-4 bg-gradient-to-br from-ink via-[#2b1a78] to-brand px-4 pb-7 pt-6 text-white md:mx-0 md:mt-4 md:rounded-3xl md:px-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Zap className="size-7 fill-blink text-blink" />Find your next phone</h1>
        <p className="mt-1 text-white/80">Search by name, brand or storage size.</p>
        <label className="relative mt-3 block">
          <span className="sr-only">Search phones</span>
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-moss" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “Samsung” or “256GB”"
                 className="w-full rounded-2xl border border-white bg-white py-3 pl-12 pr-4 text-lg text-ink md:max-w-xl" />
        </label>
      </section>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.2em] text-moss"><Sparkles className="size-5" />The latest phones</h2>
        <div className="relative">
          <button onClick={() => setMenu(!menu)} aria-label="Sort" aria-expanded={menu} className="grid size-14 place-items-center rounded-2xl border border-line bg-white"><ArrowUpDown className="size-6" /></button>
          {menu && (
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
              {Object.entries(SORTS).map(([k, label]) => (
                <button key={k} onClick={() => { setSort(k); setMenu(false); }} className={`block w-full px-4 py-3 text-left hover:bg-leaf ${sort === k ? "font-bold" : ""}`}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {["All", "Saved", ...brands].map((c) => (
          <button key={c} onClick={() => setChip(c)} aria-pressed={chip === c}
                  className={`shrink-0 rounded-full border px-6 py-3 text-lg ${chip === c ? "border-brand bg-brand font-bold text-white" : "border-line bg-white text-moss"}`}>{c}</button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loadingProducts && [0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-3xl bg-white" />)}
        {!loadingProducts && list.map((p) => <Card key={p.id} p={p} />)}
      </div>
      {!loadingProducts && !list.length && (
        <p className="mt-10 text-center text-moss">{chip === "Saved" ? "Nothing saved yet. Tap the bookmark on a phone to keep it here." : "No phones match your search."}</p>
      )}
    </>
  );
}
