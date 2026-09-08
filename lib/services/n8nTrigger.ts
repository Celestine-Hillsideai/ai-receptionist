import { after } from "next/server";
import { getConfig } from "@/lib/config";

/**
 * Kicks off n8n's post-call analysis workflow (spec §28 Workflow B). Must
 * not block the webhook response (spec §17: don't do long-running work
 * before acknowledging a webhook) — but a bare unawaited `fetch` doesn't
 * actually guarantee that on Vercel's serverless runtime, since the
 * function can freeze as soon as the response is sent, before the request
 * ever leaves the box (confirmed live: zero n8n executions after a real
 * trigger, no error logged either — the fetch never got far enough to
 * fail). `after()` defers the fetch to run post-response while keeping the
 * invocation alive until it actually settles (via Vercel's `waitUntil`).
 * Swallows its own errors — a failed trigger must not lose the call
 * record; it's already persisted, and analysis can be retried
 * independently (spec §48).
 */
export function triggerPostCallAnalysis(input: { callId: string; providerCallId: string }): void {
  const config = getConfig();
  if (!config.n8nWebhookUrl) {
    console.warn(
      `[n8nTrigger] N8N_WEBHOOK_URL not configured — skipping post-call analysis trigger for call ${input.callId}`
    );
    return;
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.internalApiSecret) headers["x-internal-secret"] = config.internalApiSecret;

  after(async () => {
    try {
      await fetch(config.n8nWebhookUrl!, {
        method: "POST",
        headers,
        body: JSON.stringify({ event: "call.ready_for_analysis", ...input }),
      });
    } catch (error) {
      console.error(`[n8nTrigger] Failed to trigger analysis for call ${input.callId}:`, error);
    }
  });
}
