# Setup, migrations and Android tooling

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env`, fill it in.
3. Apply the database baseline (below).
4. `npm run check` verifies keys and live connections (Supabase tables, storage bucket, Mailgun key, Paystack key). It sends no email and charges nothing.
5. `npm test` runs smoke tests that need no internet or database.
6. `npm run dev`, open http://localhost:5173.

## Database migrations
- Files in `supabase/migrations/` run in filename order and never edit an earlier file; every change is a new file.
- `20261011000100_baseline.sql` equals the three old SQL files combined (kept in `supabase/legacy/`). It is idempotent: safe on a fresh project and on one that already ran the old files.
- Apply: paste the file into the Supabase SQL editor and Run, or with the Supabase CLI (`supabase link`, then `supabase db push`).
- Before any migration that changes existing data: take a backup (Supabase dashboard, Database, Backups, or `pg_dump`), try it on a copy first, then compare product, order and stock counts before and after.

## Android tooling (needed from Stage 14)
- Install Android Studio (includes the Android SDK, a bundled JDK and the emulator).
- In Android Studio: Device Manager, create a virtual phone, start it.
- Check: `adb devices` lists the emulator. Windows needs hardware virtualization enabled (WHPX or Hyper-V).
- The app will live in an `android/` folder of this repository and call the same API.
