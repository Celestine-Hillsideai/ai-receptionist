import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getDailySummary } from "@/lib/services/dailySummaryService";
import { StatCard } from "@/app/dashboard/_components/StatCard";
import { formatDateTime } from "@/app/dashboard/_lib/format";
import { todayInOfficeTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function isValidDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 flex items-baseline gap-2 border-b border-rule pb-2 font-serif text-lg font-semibold text-ink">
        {title}
        <span className="font-sans text-sm font-normal text-ink-quiet">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="py-4 text-sm text-ink-quiet">Nothing here today.</p>
      ) : (
        <ul className="divide-y divide-rule-quiet">{children}</ul>
      )}
    </section>
  );
}

export default async function DailySummaryPage(props: PageProps<"/dashboard/summary">) {
  const sp = await props.searchParams;
  const dateParam = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const date = isValidDate(dateParam) ? dateParam : todayInOfficeTimezone();

  const summary = await getDailySummary(getSupabaseAdmin(), date);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Daily summary</h1>
          <p className="mt-1 text-sm text-ink-quiet">
            {summary.recipientEmail ? `Sent each morning to ${summary.recipientEmail}.` : "Configure SECRETARY_EMAIL to enable the morning email."}
          </p>
        </div>
        <form method="GET" className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2 text-ink-quiet">
            Date
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="border border-rule bg-panel px-2 py-1.5 text-ink outline-none focus:border-ink"
            />
          </label>
          <button type="submit" className="border border-ink bg-ink px-3 py-1.5 text-paper hover:bg-ink/90">
            View
          </button>
        </form>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total calls" value={summary.totalCalls} />
        <StatCard label="Urgent" value={summary.urgentCalls} tone="alarm" />
        <StatCard label="Callbacks" value={summary.callbackRequests} />
        <StatCard label="Appointments" value={summary.appointmentsRequested} />
        <StatCard label="Follow-ups pending" value={summary.followUpsPending} />
      </div>

      <Section title="Urgent calls" count={summary.urgent.length}>
        {summary.urgent.map((c) => (
          <li key={c.callId} className="py-2 text-sm">
            <Link href={`/dashboard/calls/${c.callId}`} className="font-medium text-ink hover:underline">
              {c.callerName ?? "Unknown caller"}
            </Link>
            {c.organization && <span className="text-ink-quiet"> — {c.organization}</span>}
            <p className="text-ink-quiet">{c.summary ?? "No summary available."}</p>
          </li>
        ))}
      </Section>

      <Section title="Callback requests" count={summary.callbacks.length}>
        {summary.callbacks.map((c) => (
          <li key={c.callId} className="py-2 text-sm">
            <Link href={`/dashboard/calls/${c.callId}`} className="font-medium text-ink hover:underline">
              {c.callerName ?? "Unknown caller"}
            </Link>
            <span className="text-ink-quiet"> — {c.callbackNumber ?? "no number given"}</span>
            <p className="text-ink-quiet">{c.message ?? "—"}</p>
          </li>
        ))}
      </Section>

      <Section title="Appointment requests" count={summary.appointments.length}>
        {summary.appointments.map((a, i) => (
          <li key={i} className="py-2 text-sm">
            <span className="font-medium text-ink">{a.callerName ?? "Unknown caller"}</span>
            <span className="text-ink-quiet">
              {" "}
              — {[a.requestedDate, a.requestedTime].filter(Boolean).join(" ") || "no time given"}
            </span>
            {a.notes && <p className="text-ink-quiet">{a.notes}</p>}
          </li>
        ))}
      </Section>

      <Section title="Other important calls" count={summary.otherImportant.length}>
        {summary.otherImportant.map((c) => (
          <li key={c.callId} className="py-2 text-sm">
            <Link href={`/dashboard/calls/${c.callId}`} className="font-medium text-ink hover:underline">
              {c.callerName ?? "Unknown caller"}
            </Link>
            <span className="text-ink-quiet"> — {c.intent}</span>
            <p className="text-ink-quiet">{c.summary ?? "—"}</p>
          </li>
        ))}
      </Section>

      <Section title="Follow-ups pending (all outstanding)" count={summary.followUps.length}>
        {summary.followUps.map((f) => (
          <li key={f.followUpId} className="py-2 text-sm">
            <Link href={`/dashboard/calls/${f.callId}`} className="font-medium text-ink hover:underline">
              {f.callerName ?? "Unknown caller"}
            </Link>
            {f.dueAt && <span className="text-ink-quiet"> — due {formatDateTime(f.dueAt)}</span>}
            {f.notes && <p className="text-ink-quiet">{f.notes}</p>}
          </li>
        ))}
      </Section>
    </div>
  );
}
