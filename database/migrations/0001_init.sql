-- 0001_init.sql — AI Office Receptionist core schema.
-- Tables per workflows/build-ai-receptionist.md §15, plus:
--   - webhook_events: not in the spec's table list, but required to satisfy
--     §16 idempotency ("provider + provider_call_id + event_type" must be
--     deduped) and §75 Principle 4. A repeated end-of-call-report must
--     reconcile the existing call row, not create a duplicate.
--   - organization_id columns on tenant-scoped tables, nullable and unused
--     for now, kept ready for future multi-tenancy per §65 without building
--     full multi-tenancy prematurely.
--
-- Run via the Supabase SQL editor, or `supabase db push` / psql against
-- DATABASE_URL once that's configured. All access from the app goes through
-- the service-role key server-side, so RLS below defaults to deny-all as
-- defense in depth (§38) rather than as the primary access control layer.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'secretary', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- callers
-- ---------------------------------------------------------------------------
create table callers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text,
  organization text,
  phone text, -- E.164 where known (spec §66)
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_callers_phone on callers (phone);

create trigger trg_callers_updated_at
  before update on callers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- calls
-- ---------------------------------------------------------------------------
create table calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  provider text not null,
  provider_call_id text not null,
  caller_id uuid references callers (id),
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  channel text not null default 'phone',
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'failed', 'no_answer')),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  transcript text,
  raw_payload_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_call_id)
);

create index idx_calls_provider_call_id on calls (provider_call_id);
create index idx_calls_created_at on calls (created_at desc);

create trigger trg_calls_updated_at
  before update on calls
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- webhook_events — idempotency ledger (see header note)
-- ---------------------------------------------------------------------------
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_call_id text not null,
  event_type text not null,
  call_id uuid references calls (id) on delete cascade,
  raw_payload jsonb not null,
  processed_at timestamptz not null default now(),
  unique (provider, provider_call_id, event_type)
);

create index idx_webhook_events_call_id on webhook_events (call_id);

-- ---------------------------------------------------------------------------
-- call_analysis
-- ---------------------------------------------------------------------------
create table call_analysis (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references calls (id) on delete cascade,
  summary text,
  purpose text,
  message text,
  requested_action text,
  intent text check (intent in ('general', 'sales', 'support', 'partnership', 'appointment', 'complaint', 'personal', 'other')),
  intent_confidence numeric(4, 3),
  urgency_level text not null default 'normal' check (urgency_level in ('low', 'normal', 'high', 'critical')),
  urgency_reason text,
  deadline timestamptz,
  callback_requested boolean not null default false,
  callback_number text,
  follow_up_required boolean not null default false,
  extracted_data_json jsonb,
  -- job-processing state (spec §47) — analysis can fail/retry independently
  -- of the source call record, which must never be destroyed (spec §48).
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'processing', 'completed', 'failed', 'retrying')),
  analysis_attempts integer not null default 0,
  analysis_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_call_analysis_urgency_level on call_analysis (urgency_level);

create trigger trg_call_analysis_updated_at
  before update on call_analysis
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- follow_ups
-- ---------------------------------------------------------------------------
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,
  owner_id uuid references users (id),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'not_required')),
  due_at timestamptz,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_follow_ups_status on follow_ups (status);
create index idx_follow_ups_call_id on follow_ups (call_id);

create trigger trg_follow_ups_updated_at
  before update on follow_ups
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'telegram', 'sms', 'teams', 'slack')),
  recipient text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index idx_notifications_call_id on notifications (call_id);
create index idx_notifications_status on notifications (status);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table appointments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references calls (id) on delete set null,
  caller_id uuid references callers (id),
  requested_date date,
  requested_time time,
  duration_minutes integer,
  status text not null default 'requested' check (status in ('requested', 'pending', 'confirmed', 'declined', 'cancelled')),
  calendar_event_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_appointments_status on appointments (status);

create trigger trg_appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);
create index idx_audit_logs_created_at on audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-all by default. The app talks to Supabase only
-- via the service-role key (which bypasses RLS), so these policies exist as
-- defense in depth against any future anon/authenticated-key usage, not as
-- the primary access control mechanism (spec §38).
-- ---------------------------------------------------------------------------
alter table users enable row level security;
alter table callers enable row level security;
alter table calls enable row level security;
alter table webhook_events enable row level security;
alter table call_analysis enable row level security;
alter table follow_ups enable row level security;
alter table notifications enable row level security;
alter table appointments enable row level security;
alter table audit_logs enable row level security;
