import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { fetchApi } from "./lib.js";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export function StoreProvider({ children }) {
  const [cfg, setCfg] = useState(null);
  const [sb, setSb] = useState(null);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [cart, setCart] = useState(() => read("cart", {}));
  const [saved, setSaved] = useState(() => read("saved", []));
  const [toast, setToast] = useState("");
  const timer = useRef();

  useEffect(() => localStorage.setItem("cart", JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem("saved", JSON.stringify(saved)), [saved]);

  const refreshProducts = () =>
    fetchApi("products").then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingProducts(false));

  useEffect(() => {
    let sub;
    refreshProducts();
    (async () => {
      const c = await (await fetch("/api/config")).json();
      const client = createClient(c.url, c.anonKey);
      setCfg(c); setSb(client);
      const { data } = await client.auth.getSession();
      setSession(data.session);
      sub = client.auth.onAuthStateChange((_e, s) => setSession(s)).data.subscription;
      setReady(true);
    })().catch(() => setReady(true));
    return () => sub?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(false); return; }
    setIsAdmin(null);
    fetchApi("me", {}, session.access_token).then((m) => setIsAdmin(!!m.isAdmin)).catch(() => setIsAdmin(false));
  }, [session?.access_token]);

  const flash = (m) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(""), 2200); };
  const api = (path, opts) => fetchApi(path, opts, session?.access_token);
  const signIn = () => sb?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/" } });
  const signOut = () => sb?.auth.signOut();

  const add = (id, n = 1) => {
    const p = products.find((x) => x.id === id); if (!p) return;
    const have = cart[id] || 0, next = Math.min(have + n, p.stock);
    if (next === have) return flash("That's all we have in stock");
    setCart({ ...cart, [id]: next }); flash(`${p.name} added to cart`);
  };
  const dec = (id) => setCart((c) => { const n = (c[id] || 1) - 1; const rest = { ...c }; delete rest[id]; return n > 0 ? { ...c, [id]: n } : rest; });
  const remove = (id) => setCart((c) => { const rest = { ...c }; delete rest[id]; return rest; });
  const clear = () => setCart({});
  const toggleSaved = (id) => setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const lines = useMemo(() => Object.entries(cart).map(([id, qty]) => ({ p: products.find((x) => x.id === id), qty })).filter((l) => l.p), [cart, products]);
  const count = lines.reduce((t, l) => t + l.qty, 0);
  const total = lines.reduce((t, l) => t + l.p.price_cents * l.qty, 0);

  const value = { cfg, session, ready, isAdmin, products, loadingProducts, refreshProducts, lines, count, total, add, dec, remove, clear, saved, toggleSaved, toast, flash, api, signIn, signOut };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
