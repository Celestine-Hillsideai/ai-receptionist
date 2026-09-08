# Deployment (Vercel)

The dashboard and API routes are a standard Next.js App Router project, so Vercel's zero-config Next.js support applies directly — no `vercel.json` or Dockerfile needed for this piece. n8n and any self-hosted services stay wherever you're already running them; only this Next.js app deploys to Vercel.

## Before you deploy — read this

**The dashboard has no login yet.** Phase 5 shipped the UI (Dashboard, Calls, Call Detail, Daily Summary, Settings) without dashboard authentication — a deliberate scope decision, not an oversight (see `workflows/build-ai-receptionist.md` §5 for the RBAC this is standing in for). Call transcripts, caller phone numbers, and message content are all visible to anyone who can reach the deployed URL.

**"Vercel Authentication" (the free Deployment Protection option) does NOT close this gap — confirmed by testing, not assumption.** It only protects the random per-deployment URL (`<project>-<hash>-<team>.vercel.app`); it does **not** cover the friendly production alias (`<project>-<team>.vercel.app` and any custom domain), which is the URL anyone would actually use. "Password Protection" *does* cover the real domain, but requires Vercel's paid **Advanced Deployment Protection** add-on — on a Hobby/free team it's rejected outright ("Advanced Deployment Protection is not enabled on your team").

So on a free plan, the real options are:

1. **Add app-level auth** — a lightweight shared-password gate (Next.js middleware, one env var, cookie session) as a stopgap, or real per-user auth via Supabase Auth matched against the `users` table's `role` column (`admin`/`secretary`/`viewer`, see `database/migrations/0001_init.sql`) for the real thing. Neither exists yet.
2. **Upgrade to Vercel Pro** to unlock Password Protection at the platform level (no code change).
3. **Accept the risk** for now if there's no real caller data yet (e.g. Vapi isn't connected, so nothing but dev seed data is exposed) — but revisit before connecting a real voice channel.
4. **Pause the deployment** (`vercel pause`) until one of the above is in place.

**Current state of the `hillsideai/ai-receptionist` deployment: option 3 — knowingly left open, no auth, because no real caller data exists yet (Vapi not connected).** Revisit this before wiring up Vapi.

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
   **Known gotcha:** `vercel link`'s monorepo auto-detection scans the whole working tree and can misidentify `tools/n8n-mcp` (which ships a Jekyll `_config.yml` for its docs) as a deployable "service," then fail with `Invalid vercel.json - services should match pattern...` (the digit in `n8n-mcp` fails Vercel's service-name pattern). `.vercelignore` does **not** prevent this — it only affects what's uploaded, not this pre-link scan. Workaround: create the project directly first, then link to it by name, which skips the scan entirely:
   ```
   vercel project add ai-receptionist
   vercel link --yes --project ai-receptionist
   ```
3. **Set the framework preset explicitly.** A project created via `vercel project add` (the workaround above) defaults to Framework Preset "Other" instead of auto-detecting Next.js — the app still builds, but Vercel serves it as a static bundle and every route 404s. Fix once:
   ```
   vercel project update ai-receptionist --framework nextjs --yes
   ```
4. **Set environment variables.** Everything in `.env.example` that the app needs at runtime must be set in the Vercel project, for each environment (Production/Preview) you use:
   - Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - Needed for the features that depend on them: `OPENAI_API_KEY`, `VAPI_API_KEY`/`VAPI_ASSISTANT_ID`/`VAPI_WEBHOOK_SECRET`, `N8N_BASE_URL`/`N8N_WEBHOOK_URL`, `INTERNAL_API_SECRET`, `EMAIL_PROVIDER`/`EMAIL_API_KEY`/`EMAIL_FROM`, `SECRETARY_EMAIL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`
   - **Set `INTERNAL_API_SECRET` before this is publicly reachable** — without it, `/api/webhooks/voice`'s downstream internal endpoints and `/api/calls*` accept unauthenticated requests (fine for local dev only, per spec §18).

   Either `vercel env add <NAME> <production|preview>` per variable (pipe the value via stdin, e.g. `printf '%s' "$value" | vercel env add KEY production --yes`, so it never lands in shell history or command args), or paste `.env`'s contents in bulk via the dashboard's Environment Variables UI.

   **`.env` itself must never reach Vercel** — add it (and `.env.local`) to `.vercelignore`, not just `.gitignore`; `vercel deploy` uploads the working tree independent of git, and the build log will say `Detected .env file, it is strongly recommended to use Vercel's env handling instead` if it slipped through.
5. **Deploy:**
   ```
   vercel --prod
   ```
6. **Set `APP_URL`** to the real production URL once you know it (the stable alias — `vercel alias ls` shows it — not the random per-deployment URL, which changes every deploy), then redeploy once so the app picks it up:
   ```
   printf '%s' "https://<your-alias>.vercel.app" | vercel env add APP_URL production --yes --force
   vercel --prod
   ```
7. **Verify it actually works**, since a 200 status alone doesn't confirm the Next.js app is being served correctly (see the framework-preset gotcha above):
   ```
   vercel curl "https://<your-alias>.vercel.app/api/health"
   ```
8. **Point Vapi's webhook** at `https://<your-deployment>/api/webhooks/voice` once the voice channel is configured (spec §17).
9. **Point n8n at the deployed app**, not `localhost`/`host.docker.internal` — update `N8N_WEBHOOK_URL` in the app's env and the app's URL in n8n's workflow nodes to the production domain (see `tools/n8n-workflows/README.md`).

## What Vercel needs from this repo

Nothing beyond what's already committed — `next build` is the build command, `app/` is auto-detected (once the framework preset is set correctly, see step 3 above). Supabase migrations (`database/migrations/`) are applied separately via the Supabase SQL editor or CLI (see `docs/DATABASE.md`); Vercel doesn't run them.
