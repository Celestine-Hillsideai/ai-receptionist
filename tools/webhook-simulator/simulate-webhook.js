#!/usr/bin/env node
// Sends a simulated Vapi webhook event to POST /api/webhooks/voice for local
// testing without a live Vapi account (spec §50 local dev, §71 MVP scope).
//
// Usage:
//   node tools/webhook-simulator/simulate-webhook.js started
//   node tools/webhook-simulator/simulate-webhook.js report
//   node tools/webhook-simulator/simulate-webhook.js report --urgent
//   node tools/webhook-simulator/simulate-webhook.js failed
//
// Options:
//   --url <url>       Target webhook URL (default: http://localhost:3000/api/webhooks/voice)
//   --call-id <id>    provider_call_id to use (default: sim-<timestamp>)
//   --secret <value>  Sent as the x-vapi-secret header (default: reads VAPI_WEBHOOK_SECRET env var)
//   --urgent          (report scenario only) uses a transcript with an explicit deadline/urgency

const args = process.argv.slice(2);
const scenario = args.find((a) => !a.startsWith("--")) ?? "report";

function flag(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : fallback;
}

const url = flag("url", "http://localhost:3000/api/webhooks/voice");
const callId = flag("call-id", `sim-${Date.now()}`);
const secret = flag("secret", process.env.VAPI_WEBHOOK_SECRET ?? "");
const urgent = args.includes("--urgent");

const startedAt = new Date(Date.now() - 3 * 60 * 1000).toISOString();
const endedAt = new Date().toISOString();

const scenarios = {
  started: {
    message: {
      type: "status-update",
      status: "in-progress",
      call: { id: callId, startedAt, customer: { number: "+15551234567" } },
    },
  },
  report: {
    message: {
      type: "end-of-call-report",
      call: { id: callId, startedAt, endedAt, customer: { number: "+15551234567" } },
      artifact: {
        transcript: urgent
          ? "Receptionist: Thanks for calling, how can I help?\n" +
            "Caller: This is Jordan Reyes from Reyes Consulting. I need someone to call me back today about a contract that expires tomorrow, it's urgent.\n" +
            "Receptionist: I understand this is time-sensitive, let me capture the details so it gets passed along promptly."
          : "Receptionist: Thanks for calling, how can I help?\n" +
            "Caller: Hi, this is Priya Nair. Just checking on the status of an invoice, no rush, no callback needed.",
        recording: { stereoUrl: `https://example-cdn.local/recordings/${callId}.wav` },
      },
    },
  },
  failed: {
    message: {
      type: "end-of-call-report",
      endedReason: "pipeline-error",
      call: { id: callId, startedAt, endedAt, customer: { number: "+15551234567" } },
      artifact: {},
    },
  },
};

const payload = scenarios[scenario];
if (!payload) {
  console.error(`Unknown scenario "${scenario}". Available: ${Object.keys(scenarios).join(", ")}`);
  process.exit(1);
}

const headers = { "content-type": "application/json" };
if (secret) headers["x-vapi-secret"] = secret;

const response = await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});

const text = await response.text();
console.log(`${response.status} ${response.statusText}`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
