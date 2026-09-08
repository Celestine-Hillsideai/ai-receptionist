import type { SupabaseClient } from "@supabase/supabase-js";
import { URGENCY_LEVELS, INTENTS, CALL_STATUSES, FOLLOW_UP_STATUSES } from "@/lib/domain/callTypes";

// Read-side queries for the dashboard (spec §29, §31). Kept separate from
// callPersistence.ts (write side, driven by the voice webhook) — the
// dashboard never mutates a `calls` row directly.

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

export interface CallsListParams {
  page: number;
  pageSize: number;
  search: string | null;
  urgency: (typeof URGENCY_LEVELS)[number] | null;
  intent: (typeof INTENTS)[number] | null;
  status: (typeof CALL_STATUSES)[number] | null;
  dateFrom: string | null; // YYYY-MM-DD, inclusive
  dateTo: string | null; // YYYY-MM-DD, inclusive
}

type SearchParamValue = string | string[] | undefined;

function single(value: SearchParamValue): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim().length > 0 ? v.trim() : null;
}

function isValidDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Pure parsing/validation of the Calls page's URL search params — unvalidated external input (spec §75 Principle 2), never trusted as-is. */
export function parseCallsListSearchParams(
  sp: Record<string, SearchParamValue>
): CallsListParams {
  const pageRaw = Number.parseInt(single(sp.page) ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const pageSizeRaw = Number.parseInt(single(sp.pageSize) ?? String(PAGE_SIZE_DEFAULT), 10);
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), PAGE_SIZE_MAX)
    : PAGE_SIZE_DEFAULT;

  const urgencyRaw = single(sp.urgency);
  const urgency = (URGENCY_LEVELS as readonly string[]).includes(urgencyRaw ?? "")
    ? (urgencyRaw as CallsListParams["urgency"])
    : null;

  const intentRaw = single(sp.intent);
  const intent = (INTENTS as readonly string[]).includes(intentRaw ?? "")
    ? (intentRaw as CallsListParams["intent"])
    : null;

  const statusRaw = single(sp.status);
  const status = (CALL_STATUSES as readonly string[]).includes(statusRaw ?? "")
    ? (statusRaw as CallsListParams["status"])
    : null;

  const dateFromRaw = single(sp.dateFrom);
  const dateToRaw = single(sp.dateTo);

  return {
    page,
    pageSize,
    search: single(sp.search),
    urgency,
    intent,
    status,
    dateFrom: isValidDate(dateFromRaw) ? dateFromRaw : null,
    dateTo: isValidDate(dateToRaw) ? dateToRaw : null,
  };
}

export interface CallsListItem {
  id: string;
  startedAt: string | null;
  createdAt: string;
  callerName: string | null;
  organization: string | null;
  phone: string | null;
  status: string;
  durationSeconds: number | null;
  urgencyLevel: string | null;
  intent: string | null;
  summary: string | null;
  callbackRequested: boolean;
  followUpStatus: string | null;
}

export interface CallsListResult {
  items: CallsListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface CallerRow {
  name: string | null;
  organization: string | null;
  phone: string | null;
}
interface AnalysisRow {
  urgency_level: string | null;
  intent: string | null;
  summary: string | null;
  callback_requested: boolean | null;
  analysis_status: string;
}
interface FollowUpRow {
  status: string;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function listCalls(
  supabase: SupabaseClient,
  params: CallsListParams
): Promise<CallsListResult> {
  let query = supabase
    .from("calls")
    .select(
      "id, started_at, created_at, status, duration_seconds, callers(name, organization, phone), call_analysis(urgency_level, intent, summary, callback_requested, analysis_status), follow_ups(status)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);
  if (params.dateFrom) query = query.gte("created_at", `${params.dateFrom}T00:00:00.000Z`);
  if (params.dateTo) query = query.lt("created_at", `${params.dateTo}T23:59:59.999Z`);
  if (params.search) {
    // caller name/org/phone live on the joined `callers` row; call_analysis
    // free-text (message/purpose) is filtered in-memory below since
    // PostgREST can't OR-filter across an embedded relation in one call.
    query = query.or(
      `name.ilike.%${params.search}%,organization.ilike.%${params.search}%,phone.ilike.%${params.search}%`,
      { referencedTable: "callers" }
    );
  }

  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  let items: CallsListItem[] = (data ?? []).map((row) => {
    const caller = firstOf(row.callers as CallerRow | CallerRow[] | null);
    const analysis = firstOf(row.call_analysis as AnalysisRow | AnalysisRow[] | null);
    const followUps = (Array.isArray(row.follow_ups) ? row.follow_ups : []) as FollowUpRow[];
    const openFollowUp = followUps.find((f) => f.status === "pending" || f.status === "in_progress");

    return {
      id: row.id,
      startedAt: row.started_at,
      createdAt: row.created_at,
      callerName: caller?.name ?? null,
      organization: caller?.organization ?? null,
      phone: caller?.phone ?? null,
      status: row.status,
      durationSeconds: row.duration_seconds,
      urgencyLevel: analysis?.analysis_status === "completed" ? analysis.urgency_level : null,
      intent: analysis?.analysis_status === "completed" ? analysis.intent : null,
      summary: analysis?.analysis_status === "completed" ? analysis.summary : null,
      callbackRequested: analysis?.callback_requested ?? false,
      followUpStatus: openFollowUp ? openFollowUp.status : followUps[0]?.status ?? null,
    };
  });

  // In-memory filters that can't be pushed into the query above.
  if (params.urgency) items = items.filter((c) => c.urgencyLevel === params.urgency);
  if (params.intent) items = items.filter((c) => c.intent === params.intent);

  return { items, total: count ?? items.length, page: params.page, pageSize: params.pageSize };
}

export interface CallDetail {
  id: string;
  providerCallId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcript: string | null;
  caller: { id: string | null; name: string | null; organization: string | null; phone: string | null; email: string | null };
  analysis: {
    status: string;
    summary: string | null;
    purpose: string | null;
    message: string | null;
    requestedAction: string | null;
    intent: string | null;
    urgencyLevel: string | null;
    urgencyReason: string | null;
    deadline: string | null;
    callbackRequested: boolean;
    callbackNumber: string | null;
    error: string | null;
  } | null;
  followUps: Array<{ id: string; status: string; dueAt: string | null; notes: string | null; completedAt: string | null }>;
  appointment: { id: string; status: string; requestedDate: string | null; requestedTime: string | null; notes: string | null } | null;
  notifications: Array<{ id: string; channel: string; status: string; sentAt: string | null; recipient: string }>;
}

export async function getCallDetail(supabase: SupabaseClient, id: string): Promise<CallDetail | null> {
  const { data: call, error } = await supabase
    .from("calls")
    .select(
      "id, provider_call_id, status, started_at, ended_at, duration_seconds, recording_url, transcript, caller_id, callers(id, name, organization, phone, email)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!call) return null;

  const [{ data: analysis }, { data: followUps }, { data: appointments }, { data: notifications }] =
    await Promise.all([
      supabase
        .from("call_analysis")
        .select(
          "analysis_status, summary, purpose, message, requested_action, intent, urgency_level, urgency_reason, deadline, callback_requested, callback_number, analysis_error"
        )
        .eq("call_id", id)
        .maybeSingle(),
      supabase
        .from("follow_ups")
        .select("id, status, due_at, notes, completed_at")
        .eq("call_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("id, status, requested_date, requested_time, notes")
        .eq("call_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("notifications")
        .select("id, channel, status, sent_at, recipient")
        .eq("call_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const caller = firstOf(
    call.callers as CallDetail["caller"] | CallDetail["caller"][] | null
  );

  return {
    id: call.id,
    providerCallId: call.provider_call_id,
    status: call.status,
    startedAt: call.started_at,
    endedAt: call.ended_at,
    durationSeconds: call.duration_seconds,
    recordingUrl: call.recording_url,
    transcript: call.transcript,
    caller: {
      id: caller?.id ?? null,
      name: caller?.name ?? null,
      organization: caller?.organization ?? null,
      phone: caller?.phone ?? null,
      email: caller?.email ?? null,
    },
    analysis: analysis
      ? {
          status: analysis.analysis_status,
          summary: analysis.summary,
          purpose: analysis.purpose,
          message: analysis.message,
          requestedAction: analysis.requested_action,
          intent: analysis.intent,
          urgencyLevel: analysis.urgency_level,
          urgencyReason: analysis.urgency_reason,
          deadline: analysis.deadline,
          callbackRequested: analysis.callback_requested,
          callbackNumber: analysis.callback_number,
          error: analysis.analysis_error,
        }
      : null,
    followUps: (followUps ?? []).map((f) => ({
      id: f.id,
      status: f.status,
      dueAt: f.due_at,
      notes: f.notes,
      completedAt: f.completed_at,
    })),
    appointment: appointments?.[0]
      ? {
          id: appointments[0].id,
          status: appointments[0].status,
          requestedDate: appointments[0].requested_date,
          requestedTime: appointments[0].requested_time,
          notes: appointments[0].notes,
        }
      : null,
    notifications: (notifications ?? []).map((n) => ({
      id: n.id,
      channel: n.channel,
      status: n.status,
      sentAt: n.sent_at,
      recipient: n.recipient,
    })),
  };
}

export const FOLLOW_UP_STATUS_OPTIONS = FOLLOW_UP_STATUSES;
