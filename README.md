# AI Office Receptionist

An AI voice receptionist that answers office calls, converses with callers, extracts structured messages, and routes notifications/follow-ups to staff. See [`workflows/build-ai-receptionist.md`](workflows/build-ai-receptionist.md) for the full engineering specification, and [`CLAUDE.md`](CLAUDE.md) for how this repo is organized (the WAT framework).

Stack: Next.js (App Router, TypeScript) for the API + admin dashboard, PostgreSQL via Supabase for persistence, n8n for orchestration (post-call AI extraction, notifications, daily digest), Vapi (planned) for the realtime voice channel, OpenAI for structured extraction, Resend for outbound email.

## Status

**The full post-call pipeline works end-to-end with real providers**, verified live: a simulated urgent call → webhook intake → real OpenAI extraction (correct caller/urgency/summary, no fabrication) → n8n orchestration → a real email delivered via Resend → delivery recorded in the database.

- Project scaffold, provider-abstraction interfaces, config/health checks, database schema.
- `POST /api/webhooks/voice` — validated, idempotent Vapi intake.
- `POST /api/internal/analyze-call` — OpenAI structured extraction, schema validation, deterministic business rules (spec §24).
- `POST /api/internal/record-notification`, `GET /api/daily-summary`.
- Three n8n workflows (`tools/n8n-workflows/`): **Post-Call Analysis** (webhook, active), **Notify: Send Urgent Call Notification** (sub-workflow, sends via Resend), **Daily Digest** (cron `0 8 * * *`, active, sends via Resend).
- **Admin dashboard** (Phase 5): Dashboard, Calls (search/filter/paginate), Call Detail (transcript, structured analysis, follow-up status/notes), Daily Summary, Settings — see `app/dashboard/`. `GET /api/calls` and `GET /api/calls/:id` added per spec §39. **Deployed to Vercel, no dashboard login yet, and Vercel's free Deployment Protection does not cover the production URL (confirmed by testing)** — currently left open deliberately since no real caller data exists yet (Vapi isn't connected). Read `docs/DEPLOYMENT.md` before connecting Vapi or treating this as production.

See `workflows/build-ai-receptionist.md` §71 for the full MVP scope, [`docs/DATABASE.md`](docs/DATABASE.md) for schema details, [`docs/API.md`](docs/API.md) for endpoint contracts, [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for deploying to Vercel, and [`tools/n8n-workflows/README.md`](tools/n8n-workflows/README.md) for the workflows and their remaining known gaps (Resend's sandbox sender can only deliver to the account's signup address until a domain is verified; no error-workflow alert channel for the digest's unattended failures). The voice prompt and dashboard authentication are not built yet.

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

- `app/` — Next.js routes: `app/api/*` (webhook intake, REST API, health checks) and `app/dashboard/*` (the admin dashboard — no auth yet, see `docs/DEPLOYMENT.md`).
- `lib/` — application code: `domain/` (canonical call model + validation schemas), `providers/` (VoiceProvider/LLMProvider/NotificationProvider/CalendarProvider/StorageProvider interfaces and implementations), `services/`, `supabase/`.
- `database/` — `migrations/` (schema, applied in order) and `seeds/` (dev-only sample data).
- `tests/` — `unit/`, `integration/`, `e2e/`.
- `tools/` — reusable scripts (webhook simulator, n8n workflow exports, n8n-mcp/n8n-skills). See `tools/README.md`.
- `workflows/` — this project's own procedure docs (not n8n exports — those live in `tools/n8n-workflows/`).
- `docs/` — architecture/API/database/deployment reference docs, added as each phase lands.
