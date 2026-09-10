# AI Office Receptionist

An AI voice receptionist that answers office calls, converses with callers, extracts structured messages, and routes notifications/follow-ups to staff. See [`workflows/build-ai-receptionist.md`](workflows/build-ai-receptionist.md) for the full engineering specification, and [`CLAUDE.md`](CLAUDE.md) for how this repo is organized (the WAT framework).

Stack: Next.js (App Router, TypeScript) for the API + admin dashboard, PostgreSQL via Supabase for persistence, n8n for orchestration (post-call AI extraction, notifications, daily digest), Vapi for the realtime voice channel, OpenAI for structured extraction, Resend for outbound email.

## Status

**The entire call pipeline is live end-to-end in production, verified with real infrastructure, not local dev**: a real inbound phone call → the live Vapi assistant → authenticated webhook (`https://ai-receptionist-hillsideai.vercel.app/api/webhooks/voice`) → persisted call record → real OpenAI extraction → self-hosted n8n (`https://n8n.hillsideai.dev`) → a real email delivered via Resend → delivery recorded in the database. Confirmed by direct inspection at every step (n8n execution statuses, the call's `notifications` array, production logs), not assumed from a 200 response.

- Project scaffold, provider-abstraction interfaces, config/health checks, database schema.
- `POST /api/webhooks/voice` — validated, idempotent Vapi intake, authenticated (`x-vapi-secret`, enforced in production).
- `POST /api/internal/analyze-call` — OpenAI structured extraction, schema validation, deterministic business rules (spec §24).
- `POST /api/internal/record-notification`, `GET /api/daily-summary`.
- **Self-hosted n8n** (Phase 4/6, `docs/N8N_DEPLOYMENT.md`) — deployed to a free-tier GCP VM (Docker Compose, Caddy auto-TLS) since the app couldn't reach `localhost` n8n. Three workflows (`tools/n8n-workflows/`) imported and active: **Post-Call Analysis** (webhook), **Notify: Send Urgent Call Notification** (sub-workflow, sends via Resend), **Daily Digest** (cron `0 8 * * *`, sends via Resend). One real production bug found and fixed here: `lib/services/n8nTrigger.ts`'s fire-and-forget fetch was silently never completing on Vercel's serverless runtime (function froze before the request finished dispatching) — fixed with Next.js's `after()`.
- **Admin dashboard** (Phase 5): Dashboard, Calls (search/filter/paginate), Call Detail (transcript, structured analysis, follow-up status/notes), Daily Summary, Settings — see `app/dashboard/`. `GET /api/calls` and `GET /api/calls/:id` added per spec §39. **Deployed to Vercel, gated behind a shared-password login** (Phase 5.1: `proxy.ts` + `DASHBOARD_PASSWORD`, see `docs/DEPLOYMENT.md`) — a stopgap ahead of real per-user auth (Supabase Auth against `users.role`), since Vercel's free Deployment Protection doesn't cover the production URL (confirmed by testing) and real caller data now exists (Vapi is connected and live).
- **Voice prompt + Vapi assistant config** (Phase 4): a live Vapi assistant (`AI Virtual Receptionist`, office of Engr. Celestine Ugwu) already existed with a real, tailored system prompt, voice (`vapi`/Elliot), model (`gpt-4.1`), and transcriber (Soniox) — built outside this repo's history. `prompts/receptionist-voice.v1.md` is a verbatim, versioned copy of that live prompt (spec §44); `tools/vapi/sync-assistant.js` fetches the live assistant, overwrites only the system-message content and `server.url`/`server.credentialId`, and PATCHes the full object back. Its `server.url` was originally pointed at a stale `trycloudflare.com` tunnel; the sync fixed it. The originally-attached phone number belonged to a Twilio account with no accessible credentials and had zero real-call history — replaced with a free Vapi-managed number, `+1 302 988 7306`. Webhook auth fully wired: a Bearer Token Custom Credential in Vapi sends `x-vapi-secret`, `VAPI_WEBHOOK_SECRET` enforcement is live. See `tools/vapi/README.md`.

See `workflows/build-ai-receptionist.md` §71 for the full MVP scope, [`docs/DATABASE.md`](docs/DATABASE.md) for schema details, [`docs/API.md`](docs/API.md) for endpoint contracts, [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for deploying to Vercel, [`docs/N8N_DEPLOYMENT.md`](docs/N8N_DEPLOYMENT.md) for the self-hosted n8n instance (server details, gotchas hit, credential ids), [`tools/vapi/README.md`](tools/vapi/README.md) for wiring up the voice channel, and [`tools/n8n-workflows/README.md`](tools/n8n-workflows/README.md) for the workflows themselves. **Real per-user auth (Supabase Auth + `users.role`) is the main remaining gap** — the shared-password gate is a stopgap, not RBAC — see `docs/DEPLOYMENT.md`'s options.

## Local development

1. **Install dependencies**
   ```
   npm install
   ```
2. **Configure environment**
   Copy `.env.example` to `.env` and fill in values. At minimum, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required for the app to boot — see `.env.example` for the full list and `docs/DATABASE.md` for how to get Supabase credentials. Other integrations (Vapi, OpenAI, email, Google Calendar) are optional; missing ones just disable that feature rather than crashing the app.
3. **Apply the database schema**
   Run `database/migrations/0001_init.sql` against your Supabase project via the SQL Editor (see `docs/DATABASE.md`). Optionally run `database/seeds/0001_dev_seed.sql` for sample data.
4. **Start the app**
   ```
   npm run dev
   ```
   Then check `http://localhost:3000/api/health` (liveness) and `http://localhost:3000/api/health/ready` (confirms DB connectivity and reports which optional integrations are configured).
5. **n8n**
   A local n8n instance is expected at `N8N_BASE_URL` (default `http://localhost:5678`); the `n8n-mcp` MCP server (see `tools/README.md`) gives Claude Code direct workflow-management access to it. Copy `.mcp.json.example` to `.mcp.json` and fill in `N8N_API_KEY` from your local n8n instance (Settings → n8n API) — `.mcp.json` is gitignored since it holds that live key. This n8n instance runs in Docker — its workflows reach the app at `http://host.docker.internal:3000`, not `localhost:3000` (which inside the container is the container itself). Set `N8N_WEBHOOK_URL=http://localhost:5678/webhook/post-call-analysis` and `INTERNAL_API_SECRET` (any random string, shared with the matching n8n credential) for the app → n8n → app round trip to work. See `tools/n8n-workflows/README.md`.
6. **Run tests**
   ```
   npm run test        # unit + integration (vitest)
   npm run typecheck   # tsc --noEmit
   npm run lint        # eslint
   ```

## Project structure

- `app/` — Next.js routes: `app/api/*` (webhook intake, REST API, health checks), `app/dashboard/*` (the admin dashboard, gated by `proxy.ts`), and `app/login/` (the shared-password gate — see `docs/DEPLOYMENT.md`).
- `lib/` — application code: `domain/` (canonical call model + validation schemas), `providers/` (VoiceProvider/LLMProvider/NotificationProvider/CalendarProvider/StorageProvider interfaces and implementations), `services/`, `supabase/`.
- `database/` — `migrations/` (schema, applied in order) and `seeds/` (dev-only sample data).
- `tests/` — `unit/`, `integration/`, `e2e/`.
- `tools/` — reusable scripts (webhook simulator, n8n workflow exports, n8n-mcp/n8n-skills). See `tools/README.md`.
- `workflows/` — this project's own procedure docs (not n8n exports — those live in `tools/n8n-workflows/`).
- `docs/` — architecture/API/database/deployment reference docs, added as each phase lands.
