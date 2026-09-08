# n8n-workflows

Exported JSON definitions for this project's own n8n workflows, version-controlled backups of what's built live in the self-hosted n8n instance at **https://n8n.hillsideai.dev** (see `docs/N8N_DEPLOYMENT.md` for the server itself — GCP free-tier VM, gotchas hit, credential ids). Originally built against a local instance (`http://localhost:5678`) via the `n8n-mcp` MCP server; re-exported from the real deployed instance once that went live. Not to be confused with the top-level `/workflows/` folder, which holds this project's own procedure documents (the WAT framework's "W"), not n8n exports.

## Workflows (spec §28)

- **[post-call-analysis.json](post-call-analysis.json)** — Workflow B. `POST /webhook/post-call-analysis`, triggered by the app's `lib/services/n8nTrigger.ts` after a new `end-of-call-report`. Calls `POST /api/internal/analyze-call`, and on `notificationUrgency` of `immediate`/`prompt`, calls the Notify sub-workflow. **Active.**
- **[notify-send-urgent-call-notification.json](notify-send-urgent-call-notification.json)** — Workflow C, built as a proper sub-workflow (typed "Define Below" inputs) rather than embedded in B, so it's independently testable/reusable. Sends the email, then records the result via `POST /api/internal/record-notification`. Sub-workflows don't activate (no listener) — this one is invoked directly by B's Execute Workflow node regardless of active state.
- **[daily-digest.json](daily-digest.json)** — Workflow D. Cron `0 8 * * *` (daily 08:00 UTC — not yet business-hours/timezone aware, see spec §64). Calls `GET /api/daily-summary`, formats the spec §27 digest text, sends it. **Active.**

All DB access, LLM extraction, schema validation, and business rules (spec §24) live in the Next.js app, not in n8n expressions (spec §4.3) — these workflows only ever talk to the app's `/api/internal/*` endpoints (auth: `x-internal-secret` header, credential `AI Receptionist Internal API`) plus the Resend email API. n8n needs zero direct Supabase access.

**Status as of last verification: fully working end-to-end in production**, confirmed via a live simulated urgent call against the deployed app (`https://ai-receptionist-hillsideai.vercel.app`) and this real n8n instance — real OpenAI extraction → n8n execution status `success` on both workflows → real email delivered via Resend → delivery recorded in `notifications`. See git history for the full session trace.

## Email: Resend, not SMTP

Both `Send Email` nodes call `POST https://api.resend.com/emails` directly via an `HTTP Request` node (credential `Resend API`, header auth), not n8n's built-in SMTP `Send Email` node. Reason: n8n's generic SMTP node has a documented, unresolved community bug sending via Gmail on implicit-TLS port 465 (`Connection closed unexpectedly`, no settings fix found) — confirmed on this instance via raw-protocol diagnostics (a hand-rolled TLS/SMTP script completed a full send successfully every time; n8n's own SMTP node failed nearly every time with the same credentials). Port 587 (STARTTLS) is also blocked on this network, ruling out that workaround. Resend's HTTP API sidesteps the whole SMTP stack.

- `fromEmail` is Resend's **sandbox sender** (`onboarding@resend.dev`), which can only deliver to the email address the Resend account was signed up with, until a custom domain is verified in Resend. Verify a domain before sending to arbitrary recipients in production.
- Credential `Resend API` (id `5jxIVW4TeCw5DCMa` on the live instance — see `docs/N8N_DEPLOYMENT.md`) holds the API key as an `Authorization: Bearer <key>` header, scoped to `api.resend.com` only.

## Known gaps / next steps

- **No workflow-level error workflow** for the Daily Digest's unattended failures (spec: n8n-error-handling recommends one for scheduled workflows) — failures currently only show up in `n8n_executions` for this workflow, there's no alert channel configured yet.
- **Digest delivery isn't recorded in the `notifications` table** — that table's `call_id` is `NOT NULL` (spec §15 schema, tied to a single call), but a digest isn't associated with one call. n8n's own execution history is the delivery record for now; revisit if a dedicated digest-delivery record becomes important.
- **Resend sandbox sender restriction** — see above; only deliver to the Resend account's signup address until a domain is verified.
- **This n8n version requires sub-workflows to be published/active too**, not just the parent — activating Post-Call Analysis before activating the Notify sub-workflow fails with "which is not published. Please publish all referenced sub-workflows first." Both are active on the live instance now.
- **Fixed during live testing:** `analyzeCall`'s cache-hit path (spec §46, don't re-invoke the LLM for an already-analyzed call) originally returned `notification: null` unconditionally — meaning a retried `POST /api/internal/analyze-call` (e.g. n8n's own `retryOnFail` firing after a slow-but-successful first attempt) could silently skip an urgent notification even though the analysis itself was correct and stored. Fixed in `lib/services/callAnalysisService.ts` to rebuild the full notification block from the stored `extracted_data_json` on every cache-hit, not just the first successful call.
- **Fixed during this deployment:** `lib/services/n8nTrigger.ts`'s fire-and-forget `fetch()` to n8n's webhook silently never completed on Vercel's serverless runtime (the function froze right after the response was sent, before the unawaited request finished dispatching — confirmed live: zero n8n executions, no error logged either). Fixed with Next.js's `after()`.

## Re-importing

These files are exported from the live instance (`https://n8n.hillsideai.dev`, see `docs/N8N_DEPLOYMENT.md`) via its REST API (`POST /api/v1/workflows`), not the n8n UI's Import from File — credential ids and the Notify sub-workflow's id are instance-specific and get rewritten on import (see the deployment doc for what to change). If using `n8n-mcp` against this instance instead, `n8n_create_workflow` / `n8n_update_partial_workflow` work the same way — see `n8n-mcp-tools-expert`.
