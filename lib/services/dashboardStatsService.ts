import type { SupabaseClient } from "@supabase/supabase-js";
import { listCalls, type CallsListItem } from "@/lib/services/callsQueryService";
import { officeDayBoundsUtc, todayInOfficeTimezone } from "@/lib/timezone";

// Aggregate counts for the Dashboard overview page (spec §29). "Urgent
// calls" and "calls today" are both scoped to the current office-timezone
// (WAT) day, matching the daily-digest framing (spec §27) — this page is a
// same-day activity board, not a lifetime backlog view (that's what Calls +
// filters are for).

export interface DashboardStats {
  callsToday: number;
  urgentToday: number;
  callbacksPending: number;
  appointmentsPending: number;
  followUpsOverdue: number;
  recentCalls: CallsListItem[];
}

interface CallWithAnalysisAndFollowUps {
  call_analysis: { urgency_level: string; analysis_status: string; callback_requested: boolean } | { urgency_level: string; analysis_status: string; callback_requested: boolean }[] | null;
  follow_ups: { status: string }[] | null;
}

function embeddedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const { start, end } = officeDayBoundsUtc(todayInOfficeTimezone());
  const nowIso = new Date().toISOString();

  const [todayCalls, callbackCalls, appointmentCount, overdueCount, recent] = await Promise.all([
    supabase
      .from("calls")
      .select("id, call_analysis(urgency_level, analysis_status, callback_requested)", { count: "exact" })
      .gte("created_at", start)
      .lt("created_at", end),
    // call_analysis and follow_ups are both children of `calls`, not of each
    // other, so this reads from the `calls` side (no date scope — see
    // module doc comment: this is a backlog gauge, not a same-day count).
    supabase
      .from("calls")
      .select("id, call_analysis(urgency_level, analysis_status, callback_requested), follow_ups(status)"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "pending"]),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"])
      .lt("due_at", nowIso),
    listCalls(supabase, {
      page: 1,
      pageSize: 8,
      search: null,
      urgency: null,
      intent: null,
      status: null,
      dateFrom: null,
      dateTo: null,
    }),
  ]);

  if (todayCalls.error) throw todayCalls.error;
  if (callbackCalls.error) throw callbackCalls.error;
  if (appointmentCount.error) throw appointmentCount.error;
  if (overdueCount.error) throw overdueCount.error;

  const urgentToday = (todayCalls.data ?? []).filter((row) => {
    const analysis = embeddedOne(row.call_analysis as CallWithAnalysisAndFollowUps["call_analysis"]);
    return analysis?.analysis_status === "completed" && ["critical", "high"].includes(analysis.urgency_level);
  }).length;

  const callbacksPending = (callbackCalls.data ?? []).filter((row) => {
    const analysis = embeddedOne(row.call_analysis as CallWithAnalysisAndFollowUps["call_analysis"]);
    if (!analysis || analysis.analysis_status !== "completed" || !analysis.callback_requested) return false;
    const followUps = (row.follow_ups ?? []) as { status: string }[];
    if (followUps.length === 0) return true;
    return followUps.some((f) => f.status === "pending" || f.status === "in_progress");
  }).length;

  return {
    callsToday: todayCalls.count ?? todayCalls.data?.length ?? 0,
    urgentToday,
    callbacksPending,
    appointmentsPending: appointmentCount.count ?? 0,
    followUpsOverdue: overdueCount.count ?? 0,
    recentCalls: recent.items,
  };
}
