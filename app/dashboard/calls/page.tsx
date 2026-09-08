import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listCalls, parseCallsListSearchParams } from "@/lib/services/callsQueryService";
import { URGENCY_LEVELS, INTENTS, CALL_STATUSES } from "@/lib/domain/callTypes";
import { UrgencyFlag, UrgencyTag } from "@/app/dashboard/_components/UrgencyTag";
import { Pagination } from "@/app/dashboard/_components/Pagination";
import { formatDateTime, formatDuration, titleCase } from "@/app/dashboard/_lib/format";

export const dynamic = "force-dynamic";

export default async function CallsPage(props: PageProps<"/dashboard/calls">) {
  const rawSearchParams = await props.searchParams;
  const params = parseCallsListSearchParams(rawSearchParams);
  const result = await listCalls(getSupabaseAdmin(), params);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Calls</h1>
        <p className="mt-1 text-sm text-ink-quiet">Search and filter every call the desk has logged.</p>
      </header>

      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3 border border-rule bg-panel p-4">
        <label className="flex flex-col gap-1 text-xs text-ink-quiet">
          Caller, organization, or phone
          <input
            type="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Search calls"
            className="w-56 border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-quiet">
          Urgency
          <select
            name="urgency"
            defaultValue={params.urgency ?? ""}
            className="border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          >
            <option value="">Any</option>
            {URGENCY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {titleCase(level)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-quiet">
          Reason
          <select
            name="intent"
            defaultValue={params.intent ?? ""}
            className="border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          >
            <option value="">Any</option>
            {INTENTS.map((intent) => (
              <option key={intent} value={intent}>
                {titleCase(intent)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-quiet">
          Status
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          >
            <option value="">Any</option>
            {CALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {titleCase(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-quiet">
          From
          <input
            type="date"
            name="dateFrom"
            defaultValue={params.dateFrom ?? ""}
            className="border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-quiet">
          To
          <input
            type="date"
            name="dateTo"
            defaultValue={params.dateTo ?? ""}
            className="border border-rule bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          />
        </label>
        <button type="submit" className="border border-ink bg-ink px-4 py-1.5 text-sm text-paper hover:bg-ink/90">
          Apply filters
        </button>
        {(params.search || params.urgency || params.intent || params.status || params.dateFrom || params.dateTo) && (
          <Link href="/dashboard/calls" className="text-sm text-ink-quiet hover:text-ink hover:underline">
            Clear
          </Link>
        )}
      </form>

      {result.items.length === 0 ? (
        <p className="border border-rule bg-panel py-10 text-center text-sm text-ink-quiet">
          No calls match these filters.
        </p>
      ) : (
        <ul className="divide-y divide-rule-quiet border border-rule">
          {result.items.map((call) => (
            <li key={call.id} className="flex items-stretch bg-panel">
              <UrgencyFlag level={call.urgencyLevel} />
              <Link
                href={`/dashboard/calls/${call.id}`}
                className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-paper"
              >
                <span className="w-32 shrink-0 font-mono text-xs text-ink-quiet">
                  {formatDateTime(call.startedAt ?? call.createdAt)}
                </span>
                <span className="w-40 shrink-0 truncate font-medium text-ink">
                  {call.callerName ?? "Unknown caller"}
                </span>
                <span className="w-36 shrink-0 truncate text-ink-quiet">{call.organization ?? "—"}</span>
                <span className="min-w-48 flex-1 truncate text-ink-quiet">
                  {call.summary ?? titleCase(call.status)}
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-xs text-ink-quiet">
                  {formatDuration(call.durationSeconds)}
                </span>
                <span className="w-20 shrink-0 text-right">
                  <UrgencyTag level={call.urgencyLevel} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} searchParams={rawSearchParams} />
    </div>
  );
}
