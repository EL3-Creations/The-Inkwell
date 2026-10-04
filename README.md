# The Inkwell, Focal Pens: inventory and sales app

A phone-first web app (installable PWA) for a two-person handmade pen and keychain business selling on TikTok Shop, TikTok Live, and markets.

**New here? Read [SETUP.md](SETUP.md).** It walks through accounts, keys, deploying, and the launch checklist.

## What it does

- **Inventory**: designs with pegboard number, photos, type, tier, price, quantity, Shop-safe flag, notes. Photo grid with search and filters.
- **Sales**: design, quantity, buyer handle, channel, price, status Claimed → Paid → Shipped (or Cancelled). Claiming lowers stock; cancelling restores it.
- **Live mode**: big keypad, handle, Claim. Running list and total per Live session.
- **Owes me / To ship**: unpaid claims with age; paid-but-unshipped, grouped by buyer.
- **Dashboard**: stock, inventory value, sales this week/month, unpaid total, best sellers, "consider remaking".
- **Import / Export**: CSV in for designs, CSV out for inventory and sales.
- **Login**: email + password, owners only (public sign-up disabled in Supabase).

## How it's built

| Layer | Choice | Why |
|---|---|---|
| UI | React + TypeScript, built with Vite | Small, fast, easy to change |
| Styling | Tailwind CSS v4 | Black & white with one rose accent, big tap targets |
| Data, auth, photos | Supabase (Postgres + Auth + Storage + Realtime) | One free service does all three; row-level security keeps data private |
| Hosting | Vercel | Free, deploys on every push |
| Installable | vite-plugin-pwa | Add to home screen, opens full-screen |

There is no custom server. The browser talks to Supabase directly; security lives in the database policies in `supabase/schema.sql`.

## Folder map

```
supabase/schema.sql     the whole database: tables, stock-safe functions, security, storage bucket
sample-import.csv       example bulk-import file
src/
  App.tsx               login gate + routes
  lib/
    supabase.ts         Supabase client (or demo client)
    types.ts            data types + effectivePrice()
    api.ts              every write to the database lives here
    data.tsx            loads all data once, keeps it fresh via realtime
    csv.ts              CSV parsing/export
    photos.ts           compress + upload
    format.ts           money/date helpers
    demo.ts             fake in-memory backend for demo mode (VITE_DEMO=true)
  components/           Layout (nav), ui (buttons, fields), Modal, SaleModal, SaleRow, PhotoImg
  pages/                one file per screen
public/                 icons and logo (replace logo.svg / icon-*.png with the real logo)
scripts/make-icons.mjs  regenerates placeholder icons (npm run icons)
```

## Running locally

```bash
npm install
npm run dev
```

Needs a `.env` file (copy `.env.example`) with your Supabase URL and anon key, or `VITE_DEMO=true` for fake data.

`npm run build` type-checks and builds for production. Vercel runs this automatically.

## Key rules baked into the database

- A pegboard number is unique among **active** designs. Archiving a design frees its number.
- `claim_design()` checks stock, lowers it, and writes the sale in one transaction, so two phones can't oversell.
- `cancel_sale()` restores stock. `set_sale_quantity()` adjusts stock by the difference.
- A design's price is its override if set, otherwise the tier price from Settings. Sales store the price at the time of sale.

## Not in version 1 (room left for later)

- No TikTok Shop API sync. Sales are entered by hand. A Vercel serverless function could be added alongside later without changing the app.
- No password reset from inside the app (use the Supabase dashboard).
- No materials cost / profit tracking.
