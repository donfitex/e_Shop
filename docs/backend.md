# Backend conventions (Stage 3)

## Layout
- `server.js`: routes and wiring. `server/`: small, separately tested modules:
  `errors.js` (HttpError), `validate.js` (input rules), `ratelimit.js`, `security.js` (headers, CORS), `log.js`.

## Error format
Every API error is `{ "error": "message", "code": "machine_code" }`. Server faults return a generic message plus `requestId`; the real cause is written to the server log with the same id. Codes in use: `validation_error`, `unauthorized`, `forbidden`, `not_found`, `out_of_stock`, `unavailable`, `rate_limited`, `payment_unavailable`, `too_large`, `has_orders`, `server_error`.

## Input rules (server side, every write)
- Checkout: 1 to 50 items, ids must be UUIDs, whole quantities, at most 20 of one phone, name 2-100, address 5-300, city 2-100, method `cod` or `paystack`. Duplicate lines are merged.
- Admin product: name 1-120, brand 60, specs 200, description 2000, price 0 to 100,000,000 naira, stock 0 to 100,000 (whole), at most 8 photos, and every photo must be a URL from our own storage bucket.

## Rate limits (per server instance; per user when signed in, else per IP)
All `/api`: 300 per minute. Place order: 10. Verify payment: 30. Admin upload: 30. Over the limit returns 429 with `Retry-After`.

## Headers
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production, and a Content-Security-Policy that is **report-only** until `CSP_ENFORCE=true`. Watch the browser console on the live site; when there are no violations, enforce it. CORS sends nothing unless an origin is listed in `CORS_ORIGINS`.

## Logging
One JSON line per API request: time, request id, method, path, status, duration, user id. No headers, bodies or query values.

## Known limits
Rate limiting is in memory (one instance). Stock reservation and webhooks come in Stages 7 and 11. Authentication hardening is Stage 4.
