# Database

PostgreSQL via Supabase. Schema lives in [`database/migrations/`](../database/migrations/), applied in filename order.

## Tables

See [`workflows/build-ai-receptionist.md` §15](../workflows/build-ai-receptionist.md) for the source spec. `database/migrations/0001_init.sql` implements: `users`, `callers`, `calls`, `call_analysis`, `follow_ups`, `notifications`, `appointments`, `audit_logs`, plus one addition not in the original spec list:

- **`webhook_events`** — a `(provider, provider_call_id, event_type)` unique ledger. Required to satisfy the idempotency rule in spec §16: a retried `end-of-call-report` must reconcile the existing `calls` row, never create a duplicate. The webhook handler checks/inserts here before doing anything else.

All tenant-scoped tables carry a nullable `organization_id` column, unused for now, kept ready for future multi-tenancy per spec §65 without building full multi-tenancy prematurely.

## Applying migrations (MVP — no `DATABASE_URL` configured yet)

Until a direct Postgres connection string is wired up, apply migrations by hand:

1. Open the Supabase dashboard → your project → **SQL Editor** → **New query**.
2. Paste the contents of `database/migrations/0001_init.sql`, run it.
3. (Optional, local/dev only) Paste `database/seeds/0001_dev_seed.sql` and run it to get sample data for the dashboard.

Once `DATABASE_URL` is set (Project Settings → Database → Connection string), migrations can be scripted with `psql -f database/migrations/000X_*.sql "$DATABASE_URL"` in order — a `tools/` runner script can be added when that's needed.

## Access pattern

The Next.js app talks to Supabase exclusively through the service-role key (`lib/supabase/server.ts`), server-side only. Row Level Security is enabled on every table with no permissive policies — this is defense in depth (spec §38), not the primary access control layer; RBAC is enforced in the Next.js API routes themselves. Never import `lib/supabase/server.ts` from a client component or leak the service-role key to the browser.

## Idempotency

Webhook processing must, in order:

1. Look up `(provider, provider_call_id, event_type)` in `webhook_events`.
2. If found, treat the event as already processed and short-circuit.
3. If not found, process it, then insert the ledger row inside the same transaction/logical unit as the resulting write.

This is what makes a duplicated `end-of-call-report` update the existing call rather than creating a second one (spec §16, §75 Principle 4).
