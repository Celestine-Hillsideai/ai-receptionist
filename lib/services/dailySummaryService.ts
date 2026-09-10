import type { SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";
import { officeDayBoundsUtc } from "@/lib/timezone";

// spec §27. `date` is a YYYY-MM-DD office-timezone (WAT) calendar day;
// storage stays UTC throughout (spec §66) via officeDayBoundsUtc.
//
// "Follow-ups Pending" is deliberately the full outstanding backlog, not
// just follow-ups created from today's calls — a secretary's daily digest
// should surface all owed follow-up work, not just what happened today.

export interface DailySummary {
  date: string;
  recipientEmail: string | null;
  totalCalls: number;
  urgentCalls: number;
  callbackRequests: number;
  appointmentsRequested: number;
  followUpsPending: number;
  urgent: Array<{
    callId: string;
    callerName: string | null;
    organization: string | null;
    summary: string | null;
    urgencyLevel: string;
    deadline: string | null;
  }>;
  callbacks: Array<{
    callId: string;
    callerName: string | null;
    callbackNumber: string | null;
    message: string | null;
  }>;
  appointments: Array<{
    callId: string | null;
    callerName: string | null;
    requestedDate: string | null;
    requestedTime: string | null;
    notes: string | null;
  }>;
  otherImportant: Array<{
    callId: string;
    callerName: string | null;
    summary: string | null;
    intent: string | null;
  }>;
  followUps: Array<{
    followUpId: string;
    callId: string;
    callerName: string | null;
    dueAt: string | null;
    notes: string | null;
  }>;
}

interface CallAnalysisRow {
  summary: string | null;
  purpose: string | null;
  message: string | null;
  requested_action: string | null;
  intent: string | null;
  urgency_level: string;
  deadline: string | null;
  callback_requested: boolean;
  callback_number: string | null;
  follow_up_required: boolean;
  analysis_status: string;
}

interface CallerRow {
  name: string | null;
  organization: string | null;
}

function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function getDailySummary(
  supabase: SupabaseClient,
  date: string
): Promise<DailySummary> {
  const { start, end } = officeDayBoundsUtc(date);

  const { data: calls, error: callsError } = await supabase
    .from("calls")
    .select(
      "id, created_at, callers(name, organization, phone), call_analysis(summary, purpose, message, requested_action, intent, urgency_level, deadline, callback_requested, callback_number, follow_up_required, analysis_status)"
    )
    .gte("created_at", start)
    .lt("created_at", end);
  if (callsError) throw callsError;

  const { data: appointmentRows, error: appointmentsError } = await supabase
    .from("appointments")
    .select("requested_date, requested_time, notes, calls(id, callers(name))")
    .gte("created_at", start)
    .lt("created_at", end);
  if (appointmentsError) throw appointmentsError;

  const { data: followUpRows, error: followUpsError } = await supabase
    .from("follow_ups")
    .select("id, call_id, due_at, notes, calls(callers(name))")
    .eq("status", "pending")
    .order("due_at", { ascending: true });
  if (followUpsError) throw followUpsError;

  const summary: DailySummary = {
    date,
    recipientEmail: getConfig().secretaryEmail,
    totalCalls: calls?.length ?? 0,
    urgentCalls: 0,
    callbackRequests: 0,
    appointmentsRequested: appointmentRows?.length ?? 0,
    followUpsPending: followUpRows?.length ?? 0,
    urgent: [],
    callbacks: [],
    appointments: [],
    otherImportant: [],
    followUps: [],
  };

  for (const call of calls ?? []) {
    const caller = firstOf(call.callers as CallerRow | CallerRow[] | null);
    const analysis = firstOf(call.call_analysis as CallAnalysisRow | CallAnalysisRow[] | null);
    if (!analysis || analysis.analysis_status !== "completed") continue;

    const isUrgent = analysis.urgency_level === "critical" || analysis.urgency_level === "high";
    if (isUrgent) {
      summary.urgentCalls += 1;
      summary.urgent.push({
        callId: call.id,
        callerName: caller?.name ?? null,
        organization: caller?.organization ?? null,
        summary: analysis.summary,
        urgencyLevel: analysis.urgency_level,
        deadline: analysis.deadline,
      });
    }

    if (analysis.callback_requested) {
      summary.callbackRequests += 1;
      summary.callbacks.push({
        callId: call.id,
        callerName: caller?.name ?? null,
        callbackNumber: analysis.callback_number,
        message: analysis.message,
      });
    }

    if (!isUrgent && !analysis.callback_requested && analysis.intent && analysis.intent !== "general") {
      summary.otherImportant.push({
        callId: call.id,
        callerName: caller?.name ?? null,
        summary: analysis.summary,
        intent: analysis.intent,
      });
    }
  }

  for (const appt of appointmentRows ?? []) {
    const call = firstOf(appt.calls as { id: string; callers: CallerRow | CallerRow[] | null } | Array<{ id: string; callers: CallerRow | CallerRow[] | null }> | null);
    const caller = call ? firstOf(call.callers) : null;
    summary.appointments.push({
      callId: call?.id ?? null,
      callerName: caller?.name ?? null,
      requestedDate: appt.requested_date,
      requestedTime: appt.requested_time,
      notes: appt.notes,
    });
  }

  for (const fu of followUpRows ?? []) {
    const call = firstOf(fu.calls as { callers: CallerRow | CallerRow[] | null } | Array<{ callers: CallerRow | CallerRow[] | null }> | null);
    const caller = call ? firstOf(call.callers) : null;
    summary.followUps.push({
      followUpId: fu.id,
      callId: fu.call_id,
      callerName: caller?.name ?? null,
      dueAt: fu.due_at,
      notes: fu.notes,
    });
  }

  return summary;
}
