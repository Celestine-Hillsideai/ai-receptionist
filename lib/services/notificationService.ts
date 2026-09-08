import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationChannel } from "@/lib/providers/types";

export interface RecordNotificationInput {
  callId: string;
  channel: NotificationChannel;
  recipient: string;
  status: "queued" | "sent" | "failed";
  providerMessageId?: string | null;
  errorMessage?: string | null;
}

/** Records a notification attempt (spec §25: every send must report queued/sent/failed). */
export async function recordNotification(
  supabase: SupabaseClient,
  input: RecordNotificationInput
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    call_id: input.callId,
    channel: input.channel,
    recipient: input.recipient,
    status: input.status,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
    error_message: input.errorMessage ?? null,
    provider_message_id: input.providerMessageId ?? null,
  });
  if (error) throw error;
}
