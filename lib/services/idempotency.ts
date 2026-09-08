import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalEventType } from "@/lib/domain/callTypes";

const UNIQUE_VIOLATION = "23505";

export interface RecordEventInput {
  provider: string;
  providerCallId: string;
  eventType: CanonicalEventType;
  callId: string;
  rawPayload: unknown;
}

/**
 * Records a webhook event against the (provider, provider_call_id, event_type)
 * unique ledger (spec §16). Returns isNew: false if this exact event was
 * already processed — the caller should skip any side effects (n8n trigger,
 * notifications) but the earlier `calls` upsert remains safe to have run
 * again, since it's idempotent by construction.
 */
export async function recordWebhookEvent(
  supabase: SupabaseClient,
  input: RecordEventInput
): Promise<{ isNew: boolean }> {
  const { error } = await supabase.from("webhook_events").insert({
    provider: input.provider,
    provider_call_id: input.providerCallId,
    event_type: input.eventType,
    call_id: input.callId,
    raw_payload: input.rawPayload,
  });

  if (!error) return { isNew: true };
  if (error.code === UNIQUE_VIOLATION) return { isNew: false };
  throw error;
}
