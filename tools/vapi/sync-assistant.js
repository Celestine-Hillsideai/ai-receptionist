#!/usr/bin/env node
// Syncs the live Vapi assistant to match prompts/receptionist-voice.v1.md and
// a small set of infra fields this repo owns (webhook server URL/auth) —
// spec §44: "Store prompt versions in configuration or source control... Do
// not silently modify production prompts."
//
// Design: fetch-merge-patch, not rebuild-from-env. The live assistant
// (VAPI_ASSISTANT_ID) already carries real configuration (voice, model,
// transcriber, analysis plan, compliance flags, etc.) that this repo doesn't
// own and shouldn't guess at. This script fetches the current assistant,
// changes only the system-prompt message content and the webhook `server`
// block, strips response-only fields the API won't accept back, and PATCHes
// the full result — never a hand-built payload of opinionated defaults.
// (Vapi's PATCH has a reported bug where omitting a field can reset it, e.g.
// dropping `model.messages`, so we always send the complete object back,
// not a partial diff.)
//
// If VAPI_ASSISTANT_ID is unset (bootstrapping a fresh assistant, e.g. for a
// different office), there's nothing to fetch — falls back to creating one
// from env-var defaults (see buildFreshAssistant below) and prints the new id.
//
// Usage:
//   node --env-file=.env tools/vapi/sync-assistant.js --dry-run   # prints a diff, no API call
//   node --env-file=.env tools/vapi/sync-assistant.js             # applies it
//
// One-time manual setup this script does NOT do (see tools/vapi/README.md):
// creating a Custom Credential in the Vapi dashboard so the webhook carries
// VAPI_WEBHOOK_SECRET as the `x-vapi-secret` header our app checks
// (lib/services/webhookAuth.ts). Without VAPI_SERVER_CREDENTIAL_ID set, the
// synced server URL stays unauthenticated, same as the app's own dev-only
// fallback when VAPI_WEBHOOK_SECRET is unset.
//
// Note: uses process.exitCode (not process.exit()) throughout and lets the
// event loop drain naturally — on Windows/Node 24, calling process.exit()
// while fetch's keep-alive socket is still tearing down can crash with
// "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" (a libuv/undici
// race, not a bug in this script's logic) and corrupt the exit code.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : fallback;
}

async function vapiFetch(apiKey, path, init) {
  const response = await fetch(`https://api.vapi.ai${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, ...init?.headers },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, statusText: response.statusText, body };
}

function buildFreshAssistant({ officeName, systemPrompt, serverUrl, serverCredentialId }) {
  return {
    name: optional("VAPI_ASSISTANT_NAME", `${officeName} Receptionist`),
    firstMessage: optional(
      "VAPI_FIRST_MESSAGE",
      `Thanks for calling ${officeName}. This is the virtual receptionist — how can I help you today?`
    ),
    endCallMessage: optional("VAPI_END_CALL_MESSAGE", "Thanks for calling. Have a great day."),
    model: {
      provider: optional("VAPI_MODEL_PROVIDER", "openai"),
      model: optional("VAPI_MODEL", "gpt-4o"),
      messages: [{ role: "system", content: systemPrompt }],
      ...(optional("VAPI_MODEL_CREDENTIAL_ID", null) ? { credentialId: optional("VAPI_MODEL_CREDENTIAL_ID", null) } : {}),
    },
    voice: {
      provider: optional("VAPI_VOICE_PROVIDER", "vapi"),
      voiceId: optional("VAPI_VOICE_ID", "Elliot"),
      ...(optional("VAPI_VOICE_CREDENTIAL_ID", null) ? { credentialId: optional("VAPI_VOICE_CREDENTIAL_ID", null) } : {}),
    },
    transcriber: {
      provider: optional("VAPI_TRANSCRIBER_PROVIDER", "deepgram"),
      model: optional("VAPI_TRANSCRIBER_MODEL", "nova-2"),
      language: optional("VAPI_TRANSCRIBER_LANGUAGE", "en"),
    },
    server: {
      url: serverUrl,
      ...(serverCredentialId ? { credentialId: serverCredentialId } : {}),
    },
  };
}

// Fields Vapi returns on GET but rejects (or ignores) on PATCH — response
// metadata, not configuration. Stripped before sending anything back.
const RESPONSE_ONLY_FIELDS = ["id", "orgId", "createdAt", "updatedAt", "latestVersion", "isServerUrlSecretSet"];

function applyOverrides(assistant, { systemPrompt, serverUrl, serverCredentialId }) {
  const patched = { ...assistant };
  for (const field of RESPONSE_ONLY_FIELDS) delete patched[field];

  const messages = patched.model?.messages ?? [];
  const systemIndex = messages.findIndex((m) => m.role === "system");
  const newMessages =
    systemIndex === -1
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages.map((m, i) => (i === systemIndex ? { ...m, content: systemPrompt } : m));
  patched.model = { ...patched.model, messages: newMessages };

  patched.server = {
    ...patched.server,
    url: serverUrl,
    ...(serverCredentialId ? { credentialId: serverCredentialId } : {}),
  };

  return patched;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const appUrl = optional("APP_URL", null);
  if (!appUrl) {
    console.error("Missing required environment variable: APP_URL");
    process.exitCode = 1;
    return;
  }

  const apiKey = optional("VAPI_API_KEY", null);
  if (!apiKey && !dryRun) {
    console.error("Missing required environment variable: VAPI_API_KEY");
    process.exitCode = 1;
    return;
  }

  const assistantId = optional("VAPI_ASSISTANT_ID", null);
  const serverCredentialId = optional("VAPI_SERVER_CREDENTIAL_ID", null);
  const officeName = optional("OFFICE_NAME", "the office");
  const serverUrl = `${appUrl.replace(/\/+$/, "")}/api/webhooks/voice`;

  const promptPath = join(REPO_ROOT, "prompts", "receptionist-voice.v1.md");
  const systemPrompt = readFileSync(promptPath, "utf-8").replace(/\n$/, "");
  const overrideInputs = { officeName, systemPrompt, serverUrl, serverCredentialId };

  let payload;
  let method;
  let path;

  if (assistantId) {
    if (!apiKey) {
      console.error("Fetching the current assistant (to preserve its config) needs VAPI_API_KEY, even for --dry-run.");
      process.exitCode = 1;
      return;
    }
    const current = await vapiFetch(apiKey, `/assistant/${assistantId}`, { method: "GET" });
    if (!current.ok) {
      console.error(`GET /assistant/${assistantId} -> ${current.status} ${current.statusText}`);
      console.error(current.body);
      process.exitCode = 1;
      return;
    }
    payload = applyOverrides(current.body, overrideInputs);
    method = "PATCH";
    path = `/assistant/${assistantId}`;
  } else {
    payload = buildFreshAssistant(overrideInputs);
    method = "POST";
    path = "/assistant";
  }

  if (dryRun) {
    console.log(`${method} https://api.vapi.ai${path}`);
    console.log(JSON.stringify(payload, null, 2));
    if (!serverCredentialId) {
      console.warn(
        "\n[warn] VAPI_SERVER_CREDENTIAL_ID is not set — server.url would be synced with no credentialId (unauthenticated). See tools/vapi/README.md."
      );
    }
    return;
  }

  const result = await vapiFetch(apiKey, path, { method, body: JSON.stringify(payload) });
  if (!result.ok) {
    console.error(`${method} https://api.vapi.ai${path} -> ${result.status} ${result.statusText}`);
    console.error(result.body);
    process.exitCode = 1;
    return;
  }

  console.log(`${method} https://api.vapi.ai${path} -> ${result.status} OK`);
  console.log(`server.url synced to: ${serverUrl}`);
  if (!assistantId && result.body?.id) {
    console.log(`\nNew assistant created. Set this in your env: VAPI_ASSISTANT_ID=${result.body.id}`);
  }
  if (!serverCredentialId) {
    console.warn(
      "\n[warn] VAPI_SERVER_CREDENTIAL_ID is not set — server.url was synced with no credentialId (unauthenticated). See tools/vapi/README.md."
    );
  }
}

await main();
