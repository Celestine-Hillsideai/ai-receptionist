import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/services/dashboardStatsService";
import { StatCard } from "@/app/dashboard/_components/StatCard";
import { UrgencyFlag, UrgencyTag } from "@/app/dashboard/_components/UrgencyTag";
import { formatTime, titleCase } from "@/app/dashboard/_lib/format";
import { OFFICE_TIMEZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    timeZone: OFFICE_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const stats = await getDashboardStats(getSupabaseAdmin());

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-ink">Good day — {todayLabel()}</h1>
        <p className="mt-1 text-sm text-ink-quiet">What the desk needs to know before the next call.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Calls today" value={stats.callsToday} />
        <StatCard label="Urgent today" value={stats.urgentToday} tone="alarm" />
        <StatCard label="Callbacks pending" value={stats.callbacksPending} />
        <StatCard label="Appointments pending" value={stats.appointmentsPending} />
        <StatCard label="Follow-ups overdue" value={stats.followUpsOverdue} tone="alarm" />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between border-b border-rule pb-2">
          <h2 className="font-serif text-lg font-semibold text-ink">Recent calls</h2>
          <Link href="/dashboard/calls" className="text-sm text-ink-quiet hover:text-ink hover:underline">
            View all calls
          </Link>
        </div>

        {stats.recentCalls.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-quiet">
            No calls yet. They&apos;ll appear here as soon as the line rings.
          </p>
        ) : (
          <ul className="divide-y divide-rule-quiet border-t border-rule">
            {stats.recentCalls.map((call) => (
              <li key={call.id} className="flex items-stretch">
                <UrgencyFlag level={call.urgencyLevel} />
                <Link
                  href={`/dashboard/calls/${call.id}`}
                  className="flex flex-1 items-center gap-4 px-4 py-3 text-sm hover:bg-panel"
                >
                  <span className="w-14 shrink-0 font-mono text-ink-quiet">
                    {formatTime(call.startedAt ?? call.createdAt)}
                  </span>
                  <span className="w-40 shrink-0 truncate font-medium text-ink">
                    {call.callerName ?? "Unknown caller"}
                  </span>
                  <span className="w-40 shrink-0 truncate text-ink-quiet">
                    {call.organization ?? "—"}
                  </span>
                  <span className="flex-1 truncate text-ink-quiet">{call.summary ?? titleCase(call.status)}</span>
                  {call.callbackRequested && (
                    <span className="shrink-0 text-xs text-ink-quiet">Callback</span>
                  )}
                  <span className="w-20 shrink-0 text-right">
                    <UrgencyTag level={call.urgencyLevel} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
