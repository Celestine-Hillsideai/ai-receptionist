# /tools/

Scripts and integrations the Agent (Claude Code) can invoke to get things done. Tools are the **T** in the [WAT framework](../CLAUDE.md) — the concrete, reusable means of execution, as opposed to Workflows (the procedure) or the Agent (the judgment that drives it).

## Contents

- [n8n-mcp/](n8n-mcp/) — cloned copy of [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp), an MCP server giving Claude Code direct access to n8n node documentation, workflow validation, and (optionally) live n8n workflow management. Registered as an MCP server via the project's [.mcp.json](../.mcp.json). See the local [n8n-mcp/README.md](n8n-mcp/README.md) for the upstream docs, or [n8n-mcp/docs/CLAUDE_CODE_SETUP.md](n8n-mcp/docs/CLAUDE_CODE_SETUP.md) for the Claude Code integration guide. To enable live workflow management (create/update/execute workflows on an actual n8n instance), set `N8N_API_URL` and `N8N_API_KEY` in `.mcp.json`'s `env` block — without them, only offline documentation/validation tools are available.
- [n8n-skills/](n8n-skills/) — cloned copy of [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills), the source for the 15 n8n-building Claude Code skills (`n8n-agents`, `n8n-mcp-tools-expert`, `n8n-workflow-patterns`, `n8n-validation-expert`, `n8n-node-configuration`, `n8n-code-javascript`/`-python`/`-tool`, `n8n-error-handling`, `n8n-binary-and-data`, `n8n-subworkflows`, `n8n-multi-instance`, `n8n-self-hosting`, `n8n-expression-syntax`, and the always-on router `using-n8n-mcp-skills`) that teach Claude how to use the `n8n-mcp` MCP server correctly. The skill content itself is synced into `~/.claude/skills/` (global, not project-scoped — Claude Code only discovers skills there or via an installed plugin) and is what's actually active; re-run the sync in the repo's history whenever this clone is updated, since `~/.claude/skills/` won't auto-follow it. The repo also ships a **hooks enforcement layer** (session-start skill injection, contextual reminders on `n8n-mcp` tool calls) that only activates through a real plugin install, not a manual file copy — run interactively, not by the agent: `/plugin marketplace add czlonkowski/n8n-skills` then `/plugin install n8n-mcp-skills`.

- [n8n-workflows/](n8n-workflows/) — version-controlled JSON exports of this project's own n8n workflows (Workflow B/C/D from the spec), backing up what's built live via `n8n-mcp`.
- [webhook-simulator/](webhook-simulator/) — sends simulated Vapi-style webhook events at `POST /api/webhooks/voice` for local testing without a live Vapi account.

Examples of what else belongs here as the project grows:

- database migration/seed scripts
- notification adapter test scripts (email/WhatsApp/etc.)
- any other repeatable operation currently done by hand more than once

## Conventions

- Prefer a script here over a one-off inline command when the same operation is likely to be repeated.
- Each script should be runnable on its own with a clear name (verb-first, e.g. `simulate-webhook.js`, `migrate-db.sh`) and minimal setup instructions at the top of the file.
- Keep tools narrow and single-purpose rather than building one large multi-command CLI, unless the project's tooling conventions later call for that.
