import type { SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";
import { getLLMProvider } from "@/lib/providers";
import { ExtractionError } from "@/lib/providers/openai/extractCallData";
import { CallExtractionSchema, type CallExtraction } from "@/lib/domain/callTypes";
import { applyBusinessRules, type NotificationUrgency } from "@/lib/services/businessRules";

export class CallNotFoundError extends Error {
  constructor(callId: string) {
    super(`Call ${callId} not found`);
    this.name = "CallNotFoundError";
  }
}

/**
 * Everything spec §26 asks a secretary notification to contain. Included
 * directly in the analyze-call response (rather than making n8n fetch it
 * separately from the database) so n8n's notification workflow never needs
 * its own Supabase access — it only ever talks to this app's API (spec §4.3).
 */
export interface NotificationDetails {
  callerName: string | null;
  organization: string | null;
  purpose: string | null;
  message: string | null;
  requestedAction: string | null;
  callbackRequested: boolean;
  callbackNumber: string | null;
  urgencyLevel: string;
  deadline: string | null;
  callTime: string | null;
  durationSeconds: number | null;
  followUpStatus: "pending" | "not_required";
  recipientEmail: string | null;
}

export interface CallAnalysisResult {
  callId: string;
  analysisStatus: "completed" | "failed";
  analysisError: string | null;
  urgencyLevel: string | null;
  notificationUrgency: NotificationUrgency | null;
  followUpRequired: boolean;
  summary: string | null;
  notification: NotificationDetails | null;
}

interface CallerInfo {
  name: string | null;
  organization: string | null;
  phone: string | null;
}

/**
 * Fills in the caller's name/organization from the extraction the first
 * time they're stated — `findOrCreateCaller` only ever inserts `{ phone }`,
 * so without this, a correctly extracted caller_name/organization (it's
 * right there in extracted_data_json) never reaches the `callers` table and
 * the dashboard shows "Unknown Caller" forever, even after a successful
 * analysis. Only fills currently-null fields — doesn't overwrite an
 * established name with whatever a later, possibly-misheard call says.
 * Runs on every analysis read (including the cache-hit path), so it also
 * self-heals calls that were analyzed before this fix existed.
 */
async function backfillCallerIdentity(
  supabase: SupabaseClient,
  callerId: string | null,
  caller: CallerInfo | null,
  extraction: CallExtraction
): Promise<void> {
  if (!callerId) return;
  const patch: Record<string, string> = {};
  if (extraction.caller_name && !caller?.name) patch.name = extraction.caller_name;
  if (extraction.organization && !caller?.organization) patch.organization = extraction.organization;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("callers").update(patch).eq("id", callerId);
  if (error) console.error(`[callAnalysisService] Failed to backfill caller ${callerId} identity:`, error);
}

interface CallInfo {
  startedAt: string | null;
  durationSeconds: number | null;
}

/**
 * Builds the full result — including the notification block — from a
 * validated extraction. Shared by the fresh-extraction path and the
 * already-analyzed cache-hit path (spec §46) so a retried request never
 * gets a data-impoverished response: an httpRequest-node retry (e.g. n8n's
 * retryOnFail) arriving after the analysis already completed must still
 * carry full notification data, or an urgent call's notification can be
 * silently skipped even though the analysis itself succeeded.
 */
function buildResult(
  callId: string,
  extraction: CallExtraction,
  call: CallInfo,
  caller: CallerInfo | null
): CallAnalysisResult {
  const rules = applyBusinessRules(extraction);

  const notification: NotificationDetails | null =
    rules.notificationUrgency === "immediate" || rules.notificationUrgency === "prompt"
      ? {
          callerName: extraction.caller_name ?? caller?.name ?? null,
          organization: extraction.organization ?? caller?.organization ?? null,
          purpose: extraction.purpose,
          message: extraction.message,
          requestedAction: extraction.requested_action,
          callbackRequested: extraction.callback_requested,
          callbackNumber: extraction.callback_number ?? caller?.phone ?? null,
          urgencyLevel: extraction.urgency_level,
          deadline: extraction.deadline,
          callTime: call.startedAt,
          durationSeconds: call.durationSeconds,
          followUpStatus: rules.followUpRequired ? "pending" : "not_required",
          recipientEmail: getConfig().secretaryEmail,
        }
      : null;

  return {
    callId,
    analysisStatus: "completed",
    analysisError: null,
    urgencyLevel: extraction.urgency_level,
    notificationUrgency: rules.notificationUrgency,
    followUpRequired: rules.followUpRequired,
    summary: extraction.summary,
    notification,
  };
}

/**
 * Post-call analysis (spec §21, Workflow B). Fetches the call's transcript,
 * runs LLM extraction, validates it, applies deterministic business rules
 * (§24), and persists call_analysis + any resulting follow_up/appointment.
 *
 * A missing OPENAI_API_KEY or a failed extraction is not thrown as a route
 * error — it's a documented, recoverable state (§58): the call_analysis row
 * is marked `failed` with the reason, the original call record is never
 * touched (§48), and the caller (n8n) can retry or escalate to an admin.
 */
export async function analyzeCall(
  supabase: SupabaseClient,
  callId: string
): Promise<CallAnalysisResult> {
  const { data: call, error: callError } = await supabase
    .from("calls")
    .select("id, transcript, caller_id, started_at, duration_seconds, callers(name, organization, phone)")
    .eq("id", callId)
    .maybeSingle();

  if (callError) throw callError;
  if (!call) throw new CallNotFoundError(callId);

  const caller = Array.isArray(call.callers) ? call.callers[0] : call.callers;
  const callInfo: CallInfo = { startedAt: call.started_at, durationSeconds: call.duration_seconds };

  const { data: existingAnalysis } = await supabase
    .from("call_analysis")
    .select("id, analysis_status, urgency_level, follow_up_required, summary, analysis_attempts, extracted_data_json")
    .eq("call_id", callId)
    .maybeSingle();

  // Don't re-invoke the LLM for a transcript we've already successfully
  // analyzed (spec §46) — but still return full notification data by
  // rebuilding it from the stored extraction, not a stripped-down summary.
  if (existingAnalysis?.analysis_status === "completed") {
    const stored = CallExtractionSchema.safeParse(existingAnalysis.extracted_data_json);
    if (stored.success) {
      await backfillCallerIdentity(supabase, call.caller_id, caller ?? null, stored.data);
      return buildResult(callId, stored.data, callInfo, caller ?? null);
    }
    // Stored extraction predates this field or fails validation — degrade
    // safely rather than throw, since the analysis itself is still valid.
    return {
      callId,
      analysisStatus: "completed",
      analysisError: null,
      urgencyLevel: existingAnalysis.urgency_level,
      notificationUrgency: null,
      followUpRequired: existingAnalysis.follow_up_required,
      summary: existingAnalysis.summary,
      notification: null,
    };
  }

  const attempts = existingAnalysis?.analysis_attempts ?? 0;

  async function recordFailure(reason: string): Promise<CallAnalysisResult> {
    await supabase.from("call_analysis").upsert(
      {
        call_id: callId,
        analysis_status: "failed",
        analysis_error: reason,
        analysis_attempts: attempts + 1,
      },
      { onConflict: "call_id" }
    );
    return {
      callId,
      analysisStatus: "failed",
      analysisError: reason,
      urgencyLevel: null,
      notificationUrgency: null,
      followUpRequired: false,
      summary: null,
      notification: null,
    };
  }

  if (!call.transcript) {
    return recordFailure("Call has no transcript to analyze");
  }

  const provider = getLLMProvider();
  if (!provider) {
    return recordFailure("No LLM provider configured (OPENAI_API_KEY missing)");
  }

  let extraction: CallExtraction;
  try {
    extraction = await provider.extractCallData({
      transcript: call.transcript,
      callerPhone: caller?.phone ?? null,
    });
  } catch (error) {
    const reason = error instanceof ExtractionError ? error.message : "Unknown extraction error";
    return recordFailure(reason);
  }

  const rules = applyBusinessRules(extraction);

  const { error: upsertError } = await supabase.from("call_analysis").upsert(
    {
      call_id: callId,
      summary: extraction.summary,
      purpose: extraction.purpose,
      message: extraction.message,
      requested_action: extraction.requested_action,
      intent: extraction.intent,
      intent_confidence: extraction.confidence,
      urgency_level: extraction.urgency_level,
      urgency_reason: extraction.urgency_reason,
      deadline: extraction.deadline,
      callback_requested: extraction.callback_requested,
      callback_number: extraction.callback_number,
      follow_up_required: rules.followUpRequired,
      extracted_data_json: extraction,
      analysis_status: "completed",
      analysis_error: null,
      analysis_attempts: attempts + 1,
    },
    { onConflict: "call_id" }
  );
  if (upsertError) throw upsertError;

  if (rules.followUpRequired) {
    const { error: followUpError } = await supabase.from("follow_ups").insert({
      call_id: callId,
      status: "pending",
      due_at: extraction.deadline,
      notes: extraction.requested_action ?? extraction.message,
    });
    if (followUpError) throw followUpError;
  }

  if (rules.createAppointment) {
    const { error: appointmentError } = await supabase.from("appointments").insert({
      call_id: callId,
      caller_id: call.caller_id,
      status: "requested",
      notes: extraction.message,
    });
    if (appointmentError) throw appointmentError;
  }

  await backfillCallerIdentity(supabase, call.caller_id, caller ?? null, extraction);

  return buildResult(callId, extraction, callInfo, caller ?? null);
}
