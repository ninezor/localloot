# StreetFinds

Free stuff on the kerb, found and shared by your local community. Photograph a find, pin it on the map (from photo GPS, your device location, or by hand), and neighbours can navigate straight to it.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. Note: on `localhost`, camera and geolocation work; on any other plain-HTTP address they won't — browsers require HTTPS for both. Vercel gives you HTTPS automatically.

## Deploy to Vercel (recommended)

**Option A — GitHub (best for ongoing work):**

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New Project → Import** the repo. Vercel auto-detects Vite; accept the defaults.
3. Add the environment variables (below) under **Settings → Environment Variables**, then deploy.

**Option B — CLI (fastest first deploy):**

```bash
npm i -g vercel
vercel
```

Answer the prompts, then `vercel --prod` when happy.

## Environment variables

Copy `.env.example` to `.env` for local dev, and add the same values in Vercel:

| Variable | Purpose |
| --- | --- |
| `VITE_DONATE_URL` | Where the Donate buttons point. Easiest options: [Ko-fi](https://ko-fi.com) or [Buy Me a Coffee](https://buymeacoffee.com) (zero setup, they handle payments), a Stripe Payment Link (more control, works well in AU), or a PayPal.me link. |
| `VITE_SUPABASE_URL` | Your Supabase project URL — enables the shared feed. |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key. |

Without the Supabase vars the app runs in **demo mode**: fully functional, but each visitor only sees their own posts for that session.

## Turn on the shared community feed (Supabase)

1. Create a project at supabase.com (free tier is plenty to start).
2. Open the **SQL editor**, paste the contents of `supabase/schema.sql`, and run it. This creates the `finds` table, access policies, and a public `photos` storage bucket.
3. Copy the project URL and anon key from **Settings → API** into your env vars.
4. Redeploy. The footer will switch from "Demo mode" to "Shared community feed".

## Things to know

- **Photo GPS is best-effort by design.** Photos picked from the gallery are checked for EXIF GPS (via `exifr`); photos taken through the in-app camera won't have it (browser limitation), so the app falls back to device location, and the pin is always draggable. GPS is read from the original file *before* the image is downscaled for upload, because re-encoding strips EXIF.
- **Uploads are resized client-side** to max 1600px JPEG, so a 6 MB phone photo becomes a few hundred KB.
- **Open posting = spam risk.** The schema deliberately allows anonymous posting to keep friction low for a community launch. If it takes off, add Supabase Auth (magic links are painless), restrict insert/update policies to authenticated users, and add a report button. Worth doing before promoting beyond people you trust.
- **Privacy note for your users:** posts reveal a street location by design (that's the point — the item is on a public kerb), but it's good practice to remind posters not to photograph their own house number or post from their doorstep if the item is, say, in their yard.
- **Map tiles** come from openstreetmap.org's free tile server, which is fine for a community app; if traffic grows, switch the tile URL to a free-tier provider like MapTiler or Stadia.
