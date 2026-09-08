import type { SupabaseClient } from "@supabase/supabase-js";
import { FOLLOW_UP_STATUSES } from "@/lib/domain/callTypes";

export class InvalidFollowUpStatusError extends Error {}

/** Validates an untrusted status string against the schema's enum (spec §75 Principle 2/3 — never trust unvalidated input, LLM or otherwise). */
export function parseFollowUpStatus(value: unknown): (typeof FOLLOW_UP_STATUSES)[number] {
  if (typeof value === "string" && (FOLLOW_UP_STATUSES as readonly string[]).includes(value)) {
    return value as (typeof FOLLOW_UP_STATUSES)[number];
  }
  throw new InvalidFollowUpStatusError(`Invalid follow-up status: ${String(value)}`);
}

/** Updates a follow-up's status/notes (spec §29 Call Detail, §67 auditability). Sets/clears completed_at to match status. */
export async function updateFollowUp(
  supabase: SupabaseClient,
  followUpId: string,
  input: { status?: (typeof FOLLOW_UP_STATUSES)[number]; notes?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completed_at = input.status === "completed" ? new Date().toISOString() : null;
  }
  if (input.notes !== undefined) patch.notes = input.notes;

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("follow_ups").update(patch).eq("id", followUpId);
  if (error) throw error;
}
