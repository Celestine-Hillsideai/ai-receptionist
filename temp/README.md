# /temp/

Scratch space for the current working session. Nothing here is durable project state — it's where the Agent stages transient files while executing a Workflow, instead of littering the project root.

- [outputs/](outputs/) — generated artifacts and results produced during a session
- [resources/](resources/) — temporary input/reference material needed mid-task

Files here are expected to be short-lived and are excluded from version control by the root `.gitignore` (their `README.md` files are the exception, so the folders stay documented and visible).
