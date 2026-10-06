import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Bookmark, Compass, LayoutGrid, LogOut, MessageCircle, Package, ShoppingCart, Zap } from "lucide-react";
import { useStore } from "./store.jsx";

const topLink = ({ isActive }) => `text-sm font-medium ${isActive ? "text-brand" : "text-moss hover:text-ink"}`;

function Header() {
  const { count, saved, session, signIn, signOut, isAdmin } = useStore();
  const name = session?.user?.user_metadata?.full_name || session?.user?.email || "";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-blink"><Zap className="size-6 fill-ink" /></span>
          <span className="text-2xl font-bold tracking-tight">R-<span className="text-brand">Blink</span></span>
        </Link>
        <nav className="ml-8 hidden gap-6 md:flex">
          <NavLink to="/" end className={topLink}>Shop</NavLink>
          <NavLink to="/saved" className={topLink}>Saved{saved.length ? ` (${saved.length})` : ""}</NavLink>
          <NavLink to="/orders" className={topLink}>Orders</NavLink>
          {isAdmin === true && <NavLink to="/admin" className={topLink}>Admin</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/cart" aria-label="Cart" className="relative grid size-11 place-items-center rounded-full hover:bg-leaf">
            <ShoppingCart className="size-6" />
            {count > 0 && <span className="absolute right-0 top-0 grid min-w-5 place-items-center rounded-full bg-alert px-1 text-[11px] font-bold text-white">{count}</span>}
          </Link>
          {session ? (
            <button onClick={signOut} title={`Sign out ${name}`} className="flex items-center gap-2 rounded-2xl border border-line px-3 py-2.5 text-sm font-medium hover:bg-leaf">
              <span className="grid size-6 place-items-center rounded-full bg-blink text-xs font-bold uppercase">{name[0]}</span>
              <LogOut className="size-4" />
            </button>
          ) : (
            <button onClick={signIn} className="rounded-2xl border border-line px-5 py-2.5 font-medium hover:bg-leaf">Sign in</button>
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { count, isAdmin } = useStore();
  const items = [["/", "Shop", Compass], ["/saved", "Saved", Bookmark], ["/cart", "Cart", ShoppingCart], ["/orders", "Orders", Package]];
  if (isAdmin === true) items.push(["/admin", "Admin", LayoutGrid]);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex max-w-xl justify-around px-2 py-2">
        {items.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-sm ${isActive ? "font-bold text-brand" : "text-moss"}`}>
            {({ isActive }) => (
              <>
                <Icon className="size-6" strokeWidth={isActive ? 2.4 : 1.8} />
                {label}
                {label === "Cart" && count > 0 && <span className="absolute right-1/4 top-0 grid min-w-5 place-items-center rounded-full bg-alert px-1 text-[11px] font-bold text-white">{count}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function Layout() {
  const { toast } = useStore();
  const { pathname } = useLocation();
  const wa = import.meta.env.VITE_WHATSAPP_NUMBER;
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return (
    <div className="min-h-dvh pb-28 md:pb-12">
      <Header />
      <main className="mx-auto max-w-6xl px-4"><Outlet /></main>
      <BottomNav />
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp"
           className="fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full bg-blink shadow-lg md:bottom-6">
          <MessageCircle className="size-6" />
        </a>
      )}
      {toast && <div role="status" className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm text-white shadow-lg md:bottom-8">{toast}</div>}
    </div>
  );
}
