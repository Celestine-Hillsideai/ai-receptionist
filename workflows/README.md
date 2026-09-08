# /workflows/

Step-by-step procedure files the Agent (Claude Code) follows to accomplish defined tasks. A workflow is the **W** in the [WAT framework](../CLAUDE.md) — it orchestrates *what to do and in what order*, while the Agent supplies judgment and the Tools folder supplies the scripts/integrations that actually do the work.

## Contents

- [build-ai-receptionist.md](build-ai-receptionist.md) — the master engineering specification and operating procedure for building the AI Office Receptionist end-to-end (architecture, data model, database schema, API design, testing strategy, deployment). This is the primary workflow for any full-system build task.

## Conventions

- One workflow per file, named for the outcome it produces (e.g. `deploy-to-production.md`, `add-notification-channel.md`), not the date or author.
- A workflow should be readable as an ordered checklist — phases/steps, not prose.
- When a task matches an existing workflow, follow it rather than improvising a new approach from scratch. If no workflow fits, it's fine to proceed ad hoc — consider adding a new workflow file afterward if the procedure is likely to recur.
