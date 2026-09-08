-- 0002_webhook_events_cascade.sql — fix a gap in 0001: webhook_events.call_id
-- was missing `on delete cascade`, unlike every other calls-child table
-- (call_analysis, follow_ups, notifications), which blocked deleting a call
-- (spec §33 retention/deletion must cascade safely). 0001_init.sql has been
-- corrected in place for anyone applying it fresh; this migration brings an
-- already-applied database in sync.

alter table webhook_events
  drop constraint webhook_events_call_id_fkey,
  add constraint webhook_events_call_id_fkey
    foreign key (call_id) references calls (id) on delete cascade;
