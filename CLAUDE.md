# CLAUDE.md

This file is read by Claude Code at the start of every session in this repository. It defines how work here is organized and how the agent should operate.

## Project

An AI Office Receptionist that answers calls on behalf of an office, converses with callers, extracts structured messages, and routes notifications/follow-ups to staff. **n8n is the orchestration layer** connecting the voice platform, the LLM, the database, and notification channels.

The full engineering specification — architecture, data model, database schema, API design, testing strategy, deployment — lives in [workflows/build-ai-receptionist.md](workflows/build-ai-receptionist.md). This file does not duplicate that detail; it defines the operating model around it.

## The WAT Framework

This project is organized around three concepts:

- **W — Workflows** (`/workflows/`): step-by-step procedures that orchestrate the work. A workflow says *what to do and in what order* for a given kind of task — building a feature, deploying, running a recurring process. It doesn't contain judgment calls or execution mechanics, just the procedure.
- **A — Agent**: Claude Code. The agent reads this file and the relevant workflow, plans the approach, and executes it — applying judgment, adapting to what it finds in the repo, and using the tools available to it.
- **T — Tools** (`/tools/`): the scripts and integrations the agent actually uses to get things done — n8n workflow scripts, migration scripts, webhook simulators, notification test scripts, and so on. Tools are concrete and reusable; workflows decide when and how to use them.

In short: **Workflows** define the procedure, the **Agent** supplies the judgment, **Tools** do the work.

## Folder Structure

```
/
├── CLAUDE.md              ← this file
├── workflows/              ← step-by-step procedure files (the "W")
│   └── build-ai-receptionist.md   ← master spec/procedure for the full system build
├── tools/                  ← scripts and integrations (the "T")
│   ├── n8n-mcp/              ← MCP server giving the Agent direct n8n node/workflow knowledge
│   └── n8n-skills/           ← source for the Claude Code skills that teach correct n8n-mcp usage
└── temp/                   ← scratch space, not durable project state
    ├── outputs/             ← generated artifacts/results from a session
    └── resources/           ← temporary input/reference material for a task
```

Each folder has its own `README.md` with more detail.

`.mcp.json` (project root) registers the `n8n-mcp` MCP server so Claude Code loads it automatically each session — see [tools/README.md](tools/README.md) for details and how to enable live n8n workflow management. This gives the Agent direct access to n8n's node/workflow documentation (`search_nodes`, `get_node`, `validate_workflow`, `search_templates`, etc.) plus management tools against the live local n8n instance at `http://localhost:5678` (`n8n_list_workflows`, `n8n_create_workflow`, `n8n_update_partial_workflow`, and more). `.mcp.json` sets `WEBHOOK_SECURITY_MODE=moderate` so the MCP server's SSRF protection permits this localhost connection. Before calling any `n8n-mcp` tool, consult the `using-n8n-mcp-skills` skill (and the specialist n8n skills it routes to).

## How to operate each session

1. Read this file first, then check `/workflows/` for a procedure matching the current task before improvising one from scratch.
2. For a full-system build task, follow [workflows/build-ai-receptionist.md](workflows/build-ai-receptionist.md) — it is the authoritative spec and includes its own operating procedure (Understand → Plan → Implement → Validate → Review → Report).
3. Prefer an existing script in `/tools/` over an ad hoc one-off command when the operation is likely to recur; add new scripts there as they're created.
4. Use `/temp/` for scratch and intermediate files instead of the project root — generated results go in `/temp/outputs/`, reference material the task needs goes in `/temp/resources/`. Nothing in `/temp/` is durable; don't rely on it surviving between sessions.
5. If no existing workflow fits the task, proceed using judgment, and consider adding a new workflow file to `/workflows/` afterward if the procedure is likely to recur.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
