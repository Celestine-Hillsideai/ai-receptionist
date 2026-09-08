-- 0001_dev_seed.sql — sample data for local dashboard development.
-- Safe to run repeatedly against a dev/test database only. Do not run
-- against production. Not idempotent by id (uses fixed uuids below so
-- re-running after a truncate is predictable).

insert into users (id, name, email, role) values
  ('00000000-0000-0000-0000-000000000001', 'Ada Admin', 'ada@example.com', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Sam Secretary', 'sam@example.com', 'secretary')
on conflict (id) do nothing;

insert into callers (id, name, organization, phone, email) values
  ('00000000-0000-0000-0000-000000000101', 'Jordan Reyes', 'Reyes Consulting', '+15551234567', 'jordan@reyesconsulting.example'),
  ('00000000-0000-0000-0000-000000000102', 'Priya Nair', null, '+15559876543', null)
on conflict (id) do nothing;

insert into calls (id, provider, provider_call_id, caller_id, status, started_at, ended_at, duration_seconds, transcript) values
  (
    '00000000-0000-0000-0000-000000000201',
    'vapi',
    'seed-call-001',
    '00000000-0000-0000-0000-000000000101',
    'completed',
    now() - interval '2 hours',
    now() - interval '2 hours' + interval '3 minutes',
    180,
    'Receptionist: Thanks for calling. How can I help?\nCaller: Hi, this is Jordan from Reyes Consulting, I need someone to call me back about the Q3 proposal before Friday.'
  )
on conflict (provider, provider_call_id) do nothing;

insert into call_analysis (
  call_id, summary, purpose, message, requested_action, intent, intent_confidence,
  urgency_level, urgency_reason, deadline, callback_requested, callback_number,
  follow_up_required, analysis_status
) values (
  '00000000-0000-0000-0000-000000000201',
  'Jordan Reyes requested a callback about the Q3 proposal before Friday.',
  'Follow-up on Q3 proposal',
  'Wants a callback about the Q3 proposal before Friday.',
  'Call Jordan back',
  'sales',
  0.900,
  'high',
  'Caller stated a Friday deadline',
  (now() + interval '3 days'),
  true,
  '+15551234567',
  true,
  'completed'
)
on conflict (call_id) do nothing;

insert into follow_ups (call_id, status, due_at, notes) values
  ('00000000-0000-0000-0000-000000000201', 'pending', now() + interval '3 days', 'Callback re: Q3 proposal')
on conflict do nothing;
