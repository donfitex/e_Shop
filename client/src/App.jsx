import { useEffect, useRef } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { useStore } from "./store.jsx";
import Layout from "./Layout.jsx";
import Home from "./pages/Home.jsx";
import Product from "./pages/Product.jsx";
import { Cart, Checkout, Done } from "./pages/Cart.jsx";
import Orders from "./pages/Orders.jsx";
import Admin from "./pages/Admin.jsx";

function PaystackReturn() {
  const { ready, session, api, clear, refreshProducts } = useStore();
  const nav = useNavigate();
  const handled = useRef(false);
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("reference");
    if (!ref || !ready || !session || handled.current) return;
    handled.current = true;
    (async () => {
      let to = "/done?pay=failed";
      try {
        const r = await api("orders/verify?reference=" + encodeURIComponent(ref));
        if (r.status === "paid") { clear(); to = `/done?pay=paid&mail=${r.emailSent ? 1 : 0}`; }
      } catch { /* shows the failed message */ }
      refreshProducts();
      nav(to, { replace: true });
    })();
  }, [ready, session]);
  return null;
}

export default function App() {
  return (
    <>
      <PaystackReturn />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home key="all" />} />
          <Route path="/saved" element={<Home key="saved" initialChip="Saved" />} />
          <Route path="/p/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/done" element={<Done />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Home key="all2" />} />
        </Route>
      </Routes>
    </>
  );
}
