# API

## `POST /api/webhooks/voice`

Receives Vapi server events (spec §17). Validated, mapped, and persisted idempotently before responding — no LLM work happens synchronously (spec §17, §57).

**Auth:** `x-vapi-secret` header, compared against `VAPI_WEBHOOK_SECRET` (timing-safe). If `VAPI_WEBHOOK_SECRET` is unset, the check is skipped — fine for local dev, must be set before any publicly reachable deployment (spec §18).

**Request:** raw Vapi webhook envelope, `{ "message": { "type": "...", "call": {...}, "artifact": {...}, ... } }`. See `lib/domain/callTypes.ts` (`VoiceWebhookEventSchema`) for the validated shape, and `lib/providers/vapi/mapEvent.ts` for which `message.type` values we act on. Payload field names are inferred from Vapi's public docs, not yet confirmed against a live call (see comment at the top of `callTypes.ts`) — re-verify once `VAPI_API_KEY` is live.

**Response envelope:** `{ data, error, request_id }`.

| Status | Meaning |
|---|---|
| 200 | Event processed (or already-processed — check `data.duplicate`) |
| 202 | Recognized Vapi message we don't act on (ignored, not an error) |
| 400 | Malformed JSON or payload that fails schema validation |
| 401 | `x-vapi-secret` missing/incorrect |
| 500 | Failed to persist — call/event not recorded |

**Idempotency:** keyed on `(provider, provider_call_id, event_type)` via the `webhook_events` ledger (spec §16) — see `docs/DATABASE.md`. A duplicate delivery returns `200` with `data.duplicate: true` and does not re-trigger the n8n analysis workflow.

**Side effect:** on a new (non-duplicate) `end-of-call-report`, fires (without blocking the response) a POST to `N8N_WEBHOOK_URL` to kick off post-call AI extraction (spec §28 Workflow B). No-ops with a warning log if `N8N_WEBHOOK_URL` isn't configured.

**Local testing:** `tools/webhook-simulator/simulate-webhook.js` — see `tools/webhook-simulator/README.md`.

## `POST /api/internal/analyze-call`

Internal-only endpoint, meant to be called by n8n's Workflow B trigger (spec §28) after a new `end-of-call-report` — not by any external client. Runs LLM structured extraction (spec §21-23), validates it, applies deterministic business rules (spec §24), and persists `call_analysis` + any resulting `follow_ups`/`appointments` row. Kept in application code rather than n8n expressions per spec §4.3.

**Auth:** `x-internal-secret` header, compared against `INTERNAL_API_SECRET` (same shared-secret pattern as the Vapi webhook; not part of spec §34's env list — added because §38 requires server-side authorization even for internal service-to-service calls). Unset in dev, must be set before this is reachable from anywhere but localhost.

**Request:** `{ "call_id": "<uuid>" }`

**Response `data`:** `{ callId, analysisStatus: "completed"|"failed", analysisError, urgencyLevel, notificationUrgency: "immediate"|"prompt"|"digest"|null, followUpRequired, summary, notification }` — n8n reads `notificationUrgency` to decide whether to call the Notify sub-workflow (spec §26). `notification` is populated only when `notificationUrgency` is `"immediate"` or `"prompt"`, and carries everything spec §26 requires in the secretary notification (caller, organization, purpose, message, requested action, callback info, urgency, deadline, call time/duration, follow-up status) plus `recipientEmail` (from `SECRETARY_EMAIL`) — this way n8n's notification workflow never needs its own Supabase access, it only reads this response.

**Failure handling (spec §58):** a missing `OPENAI_API_KEY` or a failed extraction is *not* an HTTP error — it's `200` with `analysisStatus: "failed"` and a reason in `analysisError`. The `call_analysis` row is marked `failed`, the original `calls` row is never modified, and n8n/an admin can retry. Verified both ways: without a key (documented failure path, no fabricated data) and with a real key against a live OpenAI call (correct structured extraction — caller name, organization, urgency, summary all matched the transcript with no fabrication).

**Idempotency/cost control (spec §46):** if `call_analysis.analysis_status` is already `completed` for that call, the LLM is not re-invoked — the full notification block is rebuilt from the stored `extracted_data_json` instead, so a retried request (e.g. an httpRequest node's `retryOnFail` firing after a slow-but-successful first attempt) still returns complete data rather than silently dropping the notification.

## `POST /api/internal/record-notification`

Internal-only endpoint, called by the Notify sub-workflow (`tools/n8n-workflows/notify-send-urgent-call-notification.json`) after attempting to send an urgent-call email, so the `notifications` table (spec §25) stays accurate even though n8n does the actual sending.

**Auth:** `x-internal-secret`, same as above.

**Request:** `{ call_id, channel: "email"|"whatsapp"|"telegram"|"sms"|"teams"|"slack", recipient, status: "queued"|"sent"|"failed", provider_message_id?, error_message? }`

## `GET /api/daily-summary`

Spec §27, §39. Defaults to today (UTC) — pass `?date=YYYY-MM-DD` for another day. Used by the Daily Digest workflow (`tools/n8n-workflows/daily-digest.json`, cron `0 8 * * *`) and, later, the dashboard's Daily Summary page.

**Auth:** `x-internal-secret`, same as above — this is a placeholder until dashboard session auth exists (Phase 5); it returns caller PII and shouldn't stay machine-only forever.

**Response `data`:** `{ date, recipientEmail, totalCalls, urgentCalls, callbackRequests, appointmentsRequested, followUpsPending, urgent[], callbacks[], appointments[], otherImportant[], followUps[] }`. `followUps` is deliberately the full outstanding backlog (not scoped to today's calls) — see `lib/services/dailySummaryService.ts`.

## `GET /api/health`, `GET /api/health/ready`

Liveness and readiness checks (spec §37, §39). `/ready` confirms the database is reachable and reports which optional provider integrations (`openai`, `vapi`, `n8n`, `email`, `googleCalendar`) currently have credentials configured.

## `GET /api/calls`

Spec §39, §31. Searchable, filterable, paginated call list backing the dashboard's Calls page. Query params: `page`, `pageSize` (max 100), `search` (matches caller name/organization/phone), `urgency` (`low`/`normal`/`high`/`critical`), `intent`, `status`, `dateFrom`/`dateTo` (`YYYY-MM-DD`, inclusive). Unrecognized or invalid values are silently dropped rather than erroring (spec §75 Principle 2 — never trust unvalidated input, but a malformed filter shouldn't break the page).

**Auth:** `x-internal-secret`, same placeholder as `/api/daily-summary` — see that endpoint's note and `docs/DEPLOYMENT.md`. **The dashboard's own pages do not call this route**; they read directly from `lib/services/callsQueryService.ts` server-side, so this endpoint exists for spec §39 compliance and future external consumers (not the UI's data path), and is one less unauthenticated surface until real session auth exists.

**Response `data`:** `{ items: CallListItem[], total, page, pageSize }`.

## `GET /api/calls/:id`

Full call detail: caller, `call_analysis`, `follow_ups`, the latest `appointment`, and `notifications` (spec §39). Same auth and "not the UI's data path" note as above — the dashboard's Call Detail page reads via `getCallDetail()` directly.

**Response:** `404` if the call doesn't exist, otherwise `data` shaped per `CallDetail` in `lib/services/callsQueryService.ts`.

## Not yet built

- `GET /api/callers`, `/api/callers/:id`, `GET/POST/PATCH /api/appointments` — no dashboard page needs these yet (Call Detail embeds caller and appointment data already); add them when something outside this app needs to read them independently.
- `GET/POST/PATCH /api/follow-ups` as a public route — follow-up status/notes updates go through a Next.js Server Action (`app/dashboard/calls/[id]/actions.ts`) instead, called directly from the Call Detail page. Deliberate: with no dashboard session auth yet, a same-origin Server Action is a smaller write surface than another `x-internal-secret`-gated public endpoint. Revisit once real auth exists and an external caller actually needs this.
- Session-based auth on any of the above — all currently share the `x-internal-secret` placeholder or are same-origin-only, both of which are "phase 5 is UI-only" placeholders, not production access control. See `docs/DEPLOYMENT.md` before deploying publicly.
