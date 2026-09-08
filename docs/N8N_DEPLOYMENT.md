# n8n deployment (self-hosted, Google Cloud free tier)

Live at **https://n8n.hillsideai.dev**. Deployed per the `n8n-self-hosting` Claude Code skill (single/regular mode — SQLite, Caddy auto-TLS) since this project has no hosting budget; see that skill's `DAY2.md` for update/backup/restore procedures, not duplicated here.

## Server

- **Google Cloud project**: `ai-receptionist-508012`, VM `n8n-host`, zone `us-central1-a`.
- **Machine type**: `e2-micro` (GCP's Always Free tier — ~1 vCPU shared, ~950MB RAM). Oracle Cloud's Always Free ARM tier (more headroom) was the first choice but the account's region had no Ampere A1 capacity available, so this project ended up on GCP's free tier instead.
- **Static IP**: `136.112.68.47` (promoted from ephemeral — GCP's default ephemeral IPs change on stop/start, which broke DNS/SSH once already before this was fixed).
- **DNS**: `n8n.hillsideai.dev` A record, managed through **Lovable's** DNS records UI (Project → Settings → Domains), not a direct registrar login — `hillsideai.dev` was registered via Lovable, which manages DNS itself rather than exposing registrar credentials.
- **SSH**: user `ejiconsult`, key-based (`ssh-ed25519`, comment `n8nadmin`). OS Login is enabled on this GCP project.

## Two real gotchas hit during setup (worth knowing before touching this box again)

1. **OS Login + minimized Ubuntu image = no sudo, silently.** The VM's Ubuntu 26.04 image is a Canonical "minimized" cloud image, and its `/etc/nsswitch.conf` was never patched to add `oslogin` to the `passwd`/`group` lines — so granting the "Compute OS Admin Login" IAM role in GCP Console does nothing on this box; SSH login works (PAM), but `sudo` never sees the granted group membership (NSS). Fixed via a GCP **startup script** (metadata → Automation → Startup script, which always runs as root on boot regardless of sudo state) that ran `usermod -aG sudo ejiconsult` + wrote a NOPASSWD sudoers file, followed by a VM restart. If this ever needs redoing (new user, new box), don't waste time waiting for IAM propagation — check `cat /etc/nsswitch.conf` first; if `oslogin` isn't in the `group:`/`passwd:` lines, IAM alone won't fix it.
2. **e2-micro is genuinely undersized for n8n.** First boot showed `Database ping failed: Database connection timed out` (SQLite under CPU starvation) and the JS task runner failing to connect (`invalid or expired grant token` — the default 30s TTL was too short for this CPU to complete the handshake). Fixed by adding a **2GB swapfile** (`/swapfile`, in `/etc/fstab`) and setting `N8N_RUNNERS_GRANT_TOKEN_TTL=120` in `docker-compose.yml`'s `n8n` service environment. Both are already applied on this box; if the VM is ever recreated from scratch, redo both before assuming n8n is broken.

## Credentials (do not exist anywhere in git — n8n's own encrypted store only)

- **`AI Receptionist Internal API`** (id `OhCoa5gZjmwm4nW3`) — HTTP Header Auth, header `x-internal-secret`, value = this project's `INTERNAL_API_SECRET`. Scoped to `ai-receptionist-hillsideai.vercel.app` only (`allowedHttpRequestDomains`).
- **`Resend API`** (id `5jxIVW4TeCw5DCMa`) — HTTP Header Auth, header `Authorization`, value `Bearer <Resend API key>`. Scoped to `api.resend.com` only.

Credentials never transfer between n8n instances (each instance's `N8N_ENCRYPTION_KEY` is unique and generated fresh on its own box, per the self-hosting skill's security rules) — if this instance is ever rebuilt, both credentials must be recreated from the real secret values, not copied.

## Workflows

Same three as `tools/n8n-workflows/` (Post-Call Analysis, the Notify sub-workflow, Daily Digest), imported via n8n's REST API with three changes from the exported JSON:
1. Credential IDs rewritten to the two above.
2. Every `http://host.docker.internal:3000/...` URL rewritten to the real `APP_URL` (`https://ai-receptionist-hillsideai.vercel.app`) — the old URLs were for reaching the app from a *local* Docker n8n; this instance needs the real internet-facing URL.
3. Post-Call Analysis's Execute Workflow node re-pointed at the Notify sub-workflow's *new* id (workflow ids also don't transfer between instances).

**This n8n version requires sub-workflows to be published/active**, not just the parent — activating only Post-Call Analysis fails with "which is not published. Please publish all referenced sub-workflows first." (the old README's assumption that "sub-workflows don't activate" was true on the prior n8n version, not this one). All three are active now.

## Verified live

A simulated urgent call through the full chain — `POST /api/webhooks/voice` → real OpenAI extraction → n8n Post-Call Analysis (execution status `success`) → Notify sub-workflow (execution status `success`) → real email sent via Resend → `POST /api/internal/record-notification` — confirmed via the call record's `notifications` array (`status: "sent"`) and n8n's own execution list, not just "no error returned."

**One real bug found and fixed along the way**, not specific to this n8n box: `lib/services/n8nTrigger.ts`'s fire-and-forget `fetch()` to n8n's webhook was silently never completing on Vercel's serverless runtime — the function can freeze immediately after the response is sent, before an unawaited `fetch` finishes dispatching. Confirmed live: zero n8n executions after a trigger, no error logged either (the request never got far enough to fail). Fixed by wrapping the fetch in Next.js's `after()` (stable since 15.1), which keeps the invocation alive via Vercel's `waitUntil` until the deferred work actually settles, without blocking the response to Vapi.
