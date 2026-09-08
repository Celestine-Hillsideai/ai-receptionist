"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { updateFollowUp, parseFollowUpStatus } from "@/lib/services/followUpService";

// Server Action, not a public API route: the dashboard has no session auth
// yet (Phase 5 scope — see docs/API.md), so mutations stay same-origin
// rather than adding another unauthenticated write endpoint. Still treats
// the submission as untrusted input per Next's Server Actions guidance —
// every field is validated, and the id used to scope the update is a
// reference the client supplies, not data it can set arbitrarily.
export async function updateFollowUpAction(formData: FormData): Promise<void> {
  const followUpId = String(formData.get("followUpId") ?? "");
  const callId = String(formData.get("callId") ?? "");
  if (!followUpId || !callId) throw new Error("Missing follow-up reference");

  const statusRaw = formData.get("status");
  const notesRaw = formData.get("notes");

  await updateFollowUp(getSupabaseAdmin(), followUpId, {
    status: statusRaw ? parseFollowUpStatus(statusRaw) : undefined,
    notes: notesRaw === null ? undefined : String(notesRaw),
  });

  revalidatePath(`/dashboard/calls/${callId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calls");
}
