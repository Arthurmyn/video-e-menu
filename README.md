# Video E-Menu — Nauryz demo

A QR dine-in e-menu built as a demo product ("Video E-Menu") to show to
restaurants. Content is real data for **Nauryz** (Astana, sourced from 2GIS),
used as a realistic worked example.

**Live:** https://app-smoky-two-48.vercel.app
**Admin:** https://app-smoky-two-48.vercel.app/admin.html

## Stack

- Frontend: vanilla HTML/CSS/JS, no build step, responsive (mobile/tablet/desktop)
- Hosting: Vercel (serverless functions + static)
- Database: Postgres via Vercel/Neon — `restaurants` / `categories` / `dishes` / `dish_sizes`, everything scoped by `restaurant_id`
- File storage: Vercel Blob (public) — dish photos and short looping videos
- Orders: posted live to a Telegram group via a bot

## Repo layout

- `app/` — the actual deployed project (Vercel root directory is set to this folder)
  - `index.html`, `app.js`, `styles.css` — the guest-facing menu
  - `admin.html`, `admin.js` — password-protected menu editor
  - `api/` — serverless functions (menu read, order → Telegram, admin CRUD, auth, video upload)
  - `db/schema.sql`, `db/seed.mjs` — schema and the one-time migration of the original 2GIS menu data
- `project/` — the original Claude Design handoff bundle (HTML/CSS/JS mockup) this app was built from
- `videos/` — source cinemagraph clips generated externally, uploaded to Vercel Blob and linked to dishes
- `marketing/` — QR code for the demo link

## Local development

```bash
cd app
npm install
vercel dev
```

Requires `.env.local` with `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_PASSWORD`,
`ADMIN_SESSION_SECRET` — pull the real values with `vercel env pull .env.local`
(never commit them; see `app/.env.example` for the shape).

## Deploying

Pushing to `main` deploys automatically via the connected GitHub repo. No
manual `vercel --prod` needed anymore.
