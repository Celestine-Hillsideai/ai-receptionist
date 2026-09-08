# /prompts/

LLM prompts kept as versioned source files, separate from application code (spec §44: "Keep the voice-agent prompt separate from application code... Store prompt versions in configuration or source control. Do not silently modify production prompts."). Applied here to the post-call extraction prompt too, for the same reason.

Naming: `<purpose>.v<N>.md`. To change a prompt's behavior, add a new version file and point the code at it — don't edit a version in place once it's been used against real calls.

## Contents

- [`call-extraction.v1.md`](call-extraction.v1.md) — system prompt for post-call structured extraction (spec §21-23), used by `lib/providers/openai/extractCallData.ts`.
- [`receptionist-voice.v1.md`](receptionist-voice.v1.md) — the realtime voice-agent system prompt (spec §44) for the live Vapi assistant (`AI Virtual Receptionist`, office of Engr. Celestine Ugwu). This is a verbatim copy of what's actually configured on Vapi — `tools/vapi/sync-assistant.js` fetches the live assistant and overwrites just the system-message content with this file's contents (plus fixing `server.url`), so this file is the editable source of truth for the prompt; edit it and re-run the script to push a change, don't edit the assistant directly in the dashboard.
