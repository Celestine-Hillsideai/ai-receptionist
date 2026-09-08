# Deployment (Vercel)

The dashboard and API routes are a standard Next.js App Router project, so Vercel's zero-config Next.js support applies directly — no `vercel.json` or Dockerfile needed for this piece. n8n and any self-hosted services stay wherever you're already running them; only this Next.js app deploys to Vercel.

## Before you deploy — read this

**The dashboard has no login yet.** Phase 5 shipped the UI (Dashboard, Calls, Call Detail, Daily Summary, Settings) without dashboard authentication — a deliberate scope decision, not an oversight (see `workflows/build-ai-receptionist.md` §5 for the RBAC this is standing in for). Call transcripts, caller phone numbers, and message content are all visible to anyone who can reach the deployed URL.

Do not deploy this to a public URL without one of:

1. **Vercel Deployment Protection** (fastest — a Vercel project setting, no code change). In the project's Settings → Deployment Protection, turn on "Vercel Authentication" (limits access to your Vercel team) or "Password Protection" (share one password with office staff). This is a stopgap, not RBAC — anyone with the password sees everything, same as an admin.
2. **Real dashboard auth** — the next piece of work, most naturally Supabase Auth matched against the existing `users` table's `role` column (`admin` / `secretary` / `viewer`, see `database/migrations/0001_init.sql`).

Until one of those is in place, treat the deployed URL as if it were the raw database.

## Steps

1. **Install the CLI and log in** (interactive — do this yourself, not via an automated agent):
   ```
   npm install -g vercel
   vercel login
   ```
2. **Link the project** from the repo root:
   ```
   vercel link
   ```
3. **Set environment variables.** Everything in `.env.example` that the app needs at runtime must be set in the Vercel project (Settings → Environment Variables), for each environment (Production/Preview) you use:
   - Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - Needed for the features that depend on them: `OPENAI_API_KEY`, `VAPI_API_KEY`/`VAPI_ASSISTANT_ID`/`VAPI_WEBHOOK_SECRET`, `N8N_BASE_URL`/`N8N_WEBHOOK_URL`, `INTERNAL_API_SECRET`, `EMAIL_PROVIDER`/`EMAIL_API_KEY`/`EMAIL_FROM`, `SECRETARY_EMAIL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`
   - Set `APP_URL` to the deployed URL (Vercel also exposes `VERCEL_URL` automatically, but the app reads `APP_URL` per spec §34)
   - **Set `INTERNAL_API_SECRET` before this is publicly reachable** — without it, `/api/webhooks/voice`'s downstream internal endpoints and `/api/calls*` accept unauthenticated requests (fine for local dev only, per spec §18).

   From the CLI, either use `vercel env add <NAME>` per variable, or paste them in the dashboard's Environment Variables UI (bulk `.env` paste is supported there).
4. **Deploy:**
   ```
   vercel --prod
   ```
5. **Point Vapi's webhook** at `https://<your-deployment>/api/webhooks/voice` once the voice channel is configured (spec §17).
6. **Point n8n at the deployed app**, not `localhost`/`host.docker.internal` — update `N8N_WEBHOOK_URL` in the app's env and the app's URL in n8n's workflow nodes to the production domain (see `tools/n8n-workflows/README.md`).

## What Vercel needs from this repo

Nothing beyond what's already committed — `next build` is the build command, `app/` is auto-detected. Supabase migrations (`database/migrations/`) are applied separately via the Supabase SQL editor or CLI (see `docs/DATABASE.md`); Vercel doesn't run them.
