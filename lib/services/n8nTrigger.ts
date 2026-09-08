import { getConfig } from "@/lib/config";

/**
 * Kicks off n8n's post-call analysis workflow (spec §28 Workflow B). Fired
 * without blocking the webhook response (spec §17: don't do long-running
 * work before acknowledging a webhook) and swallows its own errors — a
 * failed trigger must not fail the webhook or lose the call record; the
 * call is already persisted, and analysis can be retried independently
 * (spec §48).
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

  fetch(config.n8nWebhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ event: "call.ready_for_analysis", ...input }),
  }).catch((error) => {
    console.error(`[n8nTrigger] Failed to trigger analysis for call ${input.callId}:`, error);
  });
}
