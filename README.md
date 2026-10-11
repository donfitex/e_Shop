# R-Blink (React + Vite + Tailwind client, Express + Supabase API)

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill it in (Supabase, Mailgun, ADMIN_EMAILS, optional Paystack and WhatsApp number).
3. In the Supabase SQL editor run `supabase/migrations/20261011000100_baseline.sql` (safe even if you ran the old SQL files). Then `npm run check` and `npm test`. See `docs/setup-and-migrations.md`.
4. `npm run dev` then open http://localhost:5173 (React with hot reload, API on port 3000).
   In Supabase → Authentication → URL Configuration, add `http://localhost:5173/**` to Redirect URLs.
5. To test Paystack or the production build: `npm run build`, then `npm start` and open http://localhost:3000.

## Deploy on Render (free)
- Build Command: `npm install --include=dev && npm run build`
- Start Command: `node server.js`
- Add every `.env` value as an Environment Variable on Render, including `SITE_URL` (your Render address) and `VITE_WHATSAPP_NUMBER`. `VITE_` values are read at build time, so redeploy after changing them.
- Add your Render address to Supabase Redirect URLs.

## Layout
- `server.js`: API (products, orders, Paystack verify, admin, uploads) and serves `dist/`
- `client/src`: `store.jsx` (auth, products, cart, saved), `Layout.jsx` (header, bottom tabs, WhatsApp button), `pages/` (Home, Product, Cart + Checkout, Orders, Admin)
- Colours and font live in `client/src/index.css` under `@theme`.
