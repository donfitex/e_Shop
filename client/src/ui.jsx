import { Minus, Plus } from "lucide-react";

export function Cover({ p, className = "", phone = "h-44 sm:h-52" }) {
  const img = p.images?.[0];
  if (img) return <img src={img} alt={p.name} loading="lazy" className={`bg-white object-contain ${className}`} />;
  return (
    <div className={`grid place-items-center bg-leaf ${className}`}>
      <div className={`${phone} aspect-[9/18] rounded-[1.4rem] border-4 border-ink`} style={{ background: p.color }} />
    </div>
  );
}

export function StockBadge({ p }) {
  const base = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-wider";
  if (p.stock <= 0) return <span className={`${base} bg-ink text-white`}>SOLD OUT</span>;
  if (p.stock <= 5) return <span className={`${base} bg-alert text-white`}><i className="size-2 rounded-full bg-white" />ONLY {p.stock} LEFT</span>;
  return <span className={`${base} bg-white text-ink`}>IN STOCK</span>;
}

export function Stepper({ value, onDec, onInc }) {
  const b = "grid size-9 place-items-center rounded-full border border-line bg-white hover:bg-leaf";
  return (
    <div className="inline-flex items-center gap-3">
      <button type="button" className={b} onClick={onDec} aria-label="Fewer"><Minus className="size-4" /></button>
      <span className="w-6 text-center font-bold">{value}</span>
      <button type="button" className={b} onClick={onInc} aria-label="More"><Plus className="size-4" /></button>
    </div>
  );
}

export const btn = "inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-5 py-3 font-medium hover:bg-leaf";
export const input = "w-full rounded-xl border border-line bg-white px-3 py-2.5";
