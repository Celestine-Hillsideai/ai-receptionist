import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedVoiceEvent } from "@/lib/providers/vapi/mapEvent";
import { findOrCreateCaller } from "@/lib/services/callerService";

function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  ) as Partial<T>;
}

/**
 * Upserts the `calls` row for a normalized voice event. Safe to call
 * repeatedly for the same provider_call_id — later events only overwrite
 * fields they actually carry, so an out-of-order or retried event can't
 * blank out data a previous event already captured.
 */
export async function upsertCallFromEvent(
  supabase: SupabaseClient,
  provider: string,
  event: NormalizedVoiceEvent
): Promise<string> {
  const callerId = await findOrCreateCaller(supabase, event.callerPhone);

  const payload = {
    provider,
    provider_call_id: event.providerCallId,
    direction: "inbound" as const,
    channel: "phone",
    status: event.status,
    ...pickDefined({
      caller_id: callerId,
      started_at: event.startedAt,
      ended_at: event.endedAt,
      duration_seconds: event.durationSeconds,
      transcript: event.transcript,
      recording_url: event.recordingUrl,
    }),
  };

  const { data, error } = await supabase
    .from("calls")
    .upsert(payload, { onConflict: "provider,provider_call_id" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}
