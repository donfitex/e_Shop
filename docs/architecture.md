# R-Blink architecture (baseline, before the multi-category upgrade)

Status of this document: written by reading the code. Nothing here has been run against live services.

## Components
```
Browser (React + Vite + Tailwind)  --\
                                       >--  Express API (server.js) --> Supabase Postgres + Auth + Storage
Android app (planned)              --/                          \--> Paystack (payments)
                                                                 \--> Mailgun (email)
```
- Client: `client/src` (store.jsx = auth, products, cart, saved; pages/ = Home, Product, Cart/Checkout/Done, Orders, Admin).
- API: `server.js`, about 170 lines, 12 endpoints. Uses the Supabase service key; the browser only gets the public key.
- Database: `products`, `orders`, `order_items`, function `decrement_stock`, storage bucket `product-images`. Row-level security lets customers read only their own orders.

## Endpoints
Public: `GET /api/config`, `GET /api/products`.
Signed in: `GET/POST /api/orders`, `GET /api/orders/verify`, `GET /api/me`.
Admin (email allow-list in `ADMIN_EMAILS`): products CRUD, `GET /api/admin/orders`, `POST /api/admin/upload`.

## Order and payment flow today
1. Client sends cart items and address. Server re-reads prices and stock, inserts the order and its items.
2. Pay on delivery: server reduces stock, marks the order `pending`, sends the email.
3. Paystack: order is `awaiting_payment`, customer is redirected. On return, the client calls `/api/orders/verify`; the server asks Paystack, checks amount, claims the order, reduces stock and emails.

## Works as designed
Server-side price and total calculation; server-side admin check; integer kobo money; order-item name and price snapshots; single finalization of a paid order.

## Known gaps (to fix in later stages)
| # | Gap | Fix in stage |
|---|-----|--------------|
| 1 | Stock is checked at order time but reduced later, not atomically; unpaid orders hold no stock | 7 |
| 2 | No Paystack webhook or signature check; payment is only confirmed if the customer returns | 11 |
| 3 | No idempotency key, so retries or double taps can create duplicate orders | 10 |
| 4 | No rate limiting, security headers or CORS policy; uploads checked by declared type only | 3, 18 |
| 5 | SQL lives in three loose files; no versioned migrations; currency not stored | 2, 6 |
| 6 | Search and filters run in the browser over every product | 8 |
| 7 | No tests, no linting, not under Git | 0, 2 |
| 8 | No audit log of admin actions | 13 |

## What stays
All existing phones and orders, Supabase auth, Paystack, Mailgun, the R-Blink look, and the Express + React structure.
