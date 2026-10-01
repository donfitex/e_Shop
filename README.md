# Phone Mart — shop with Supabase, Google sign-in and Mailgun

Run: `npm install`, copy `.env.example` to `.env` and fill it in, then `npm start` (Node 20+).

## 1. Database (Supabase)
1. Create a project at supabase.com.
2. SQL Editor → paste and run `schema.sql` (tables, row-level security, sample products).
3. Project Settings → API: copy the URL, `anon` key and `service_role` key into `.env`. Keep the service key server-side only.
(Neon instead: run the same SQL there, but you'd need your own auth, since Neon has no built-in Google login.)

## 2. Google sign-in (Google Cloud Console)
1. console.cloud.google.com → APIs & Services → OAuth consent screen: set app name and support email.
2. Credentials → Create credentials → OAuth client ID → Web application.
3. Authorized redirect URI: `https://YOUR-REF.supabase.co/auth/v1/callback`
4. Supabase → Authentication → Providers → Google: paste the client ID and secret, enable.
5. Supabase → Authentication → URL Configuration: set Site URL to your site (`http://localhost:3000` for local) and add it to Redirect URLs.

## 3. Email (Mailgun)
1. Add and verify a sending domain (or use the sandbox domain; it only delivers to authorized recipients).
2. Copy a Sending API key and the domain into `.env`; use `MAILGUN_BASE=https://api.eu.mailgun.net` for EU accounts.

## Notes
- Prices are re-read from the database at checkout; the browser can't set them.
- Orders are saved even if the email fails; the order has an `email_sent` flag.
- There is no payment step yet. Add Paystack or Flutterwave before taking real orders; the order insert in `server.js` is where it goes.

## Phone Mart update
1. Run `phones_migration.sql` in the Supabase SQL editor (adds phone fields and sample phones).
2. Add `ADMIN_EMAILS=your@gmail.com` to `.env` (comma-separate several). Restart `npm start`.
3. Sign in with that Google account, then open `/admin.html` (an Admin link also appears in the header).

## Stock, image uploads and payments
1. Run `store_upgrade.sql` in the Supabase SQL editor (stock, multiple images, order status, storage bucket).
2. Optional online payment: sign up at paystack.com, copy the **Test Secret Key** (Settings → API Keys & Webhooks) into `PAYSTACK_SECRET_KEY`, set `SITE_URL`, restart. Without a key, only pay on delivery is offered.
3. Paystack has no setup or monthly fee, but it charges a fee on each successful live payment (see paystack.com/pricing). Test mode is free. Going live needs business verification on your Paystack account.
4. Payments are confirmed when the customer returns to the shop after paying. There is no webhook yet, so if someone pays and closes the tab early, the order stays "Awaiting payment" until you check Paystack's dashboard.
