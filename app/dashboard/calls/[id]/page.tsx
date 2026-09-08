import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCallDetail } from "@/lib/services/callsQueryService";
import { FOLLOW_UP_STATUSES } from "@/lib/domain/callTypes";
import { UrgencyTag } from "@/app/dashboard/_components/UrgencyTag";
import { formatDateTime, formatDuration, titleCase } from "@/app/dashboard/_lib/format";
import { updateFollowUpAction } from "@/app/dashboard/calls/[id]/actions";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 border-b border-rule-quiet py-2 text-sm">
      <dt className="w-36 shrink-0 text-ink-quiet">{label}</dt>
      <dd className="flex-1 text-ink">{value ?? "—"}</dd>
    </div>
  );
}

export default async function CallDetailPage(props: PageProps<"/dashboard/calls/[id]">) {
  const { id } = await props.params;
  const call = await getCallDetail(getSupabaseAdmin(), id);
  if (!call) notFound();

  const analysis = call.analysis;
  const followUp = call.followUps[0] ?? null;

  return (
    <div>
      <Link href="/dashboard/calls" className="text-sm text-ink-quiet hover:text-ink hover:underline">
        ← All calls
      </Link>

      <header className="mt-3 mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            {call.caller.name ?? "Unknown caller"}
          </h1>
          <p className="mt-1 text-sm text-ink-quiet">
            {[call.caller.organization, call.caller.phone].filter(Boolean).join(" · ") || "No caller details recorded"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <UrgencyTag level={analysis?.status === "completed" ? analysis.urgencyLevel : null} />
          <span className="text-xs text-ink-quiet">{titleCase(call.status)}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_18rem]">
        <div>
          <section>
            <h2 className="mb-2 font-serif text-lg font-semibold text-ink">Message</h2>
            {!analysis && (
              <p className="border border-rule-quiet bg-panel px-4 py-3 text-sm text-ink-quiet">
                Analysis hasn&apos;t run for this call yet.
              </p>
            )}
            {analysis?.status === "failed" && (
              <p className="border border-rule-quiet bg-panel px-4 py-3 text-sm text-ink-quiet">
                Analysis failed: {analysis.error ?? "unknown error"}. The transcript below is unaffected and can be
                re-analyzed.
              </p>
            )}
            {analysis?.status === "completed" && (
              <dl>
                <Field label="Purpose" value={analysis.purpose} />
                <Field label="Message" value={analysis.message} />
                <Field label="Requested action" value={analysis.requestedAction} />
                <Field label="Reason" value={titleCase(analysis.intent)} />
                <Field
                  label="Callback"
                  value={analysis.callbackRequested ? analysis.callbackNumber ?? "Requested, no number given" : "Not requested"}
                />
                <Field label="Urgency reason" value={analysis.urgencyReason} />
                <Field label="Deadline" value={analysis.deadline ? formatDateTime(analysis.deadline) : null} />
              </dl>
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-2 font-serif text-lg font-semibold text-ink">Call details</h2>
            <dl>
              <Field label="Started" value={formatDateTime(call.startedAt)} />
              <Field label="Duration" value={formatDuration(call.durationSeconds)} />
              <Field label="Provider call id" value={call.providerCallId} />
              {call.recordingUrl && (
                <div className="flex gap-4 border-b border-rule-quiet py-2 text-sm">
                  <dt className="w-36 shrink-0 text-ink-quiet">Recording</dt>
                  <dd className="flex-1">
                    <a href={call.recordingUrl} className="text-ink underline hover:no-underline">
                      Listen to recording
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 font-serif text-lg font-semibold text-ink">Transcript</h2>
            {call.transcript ? (
              <pre className="whitespace-pre-wrap border border-rule bg-panel p-4 font-mono text-xs leading-relaxed text-ink">
                {call.transcript}
              </pre>
            ) : (
              <p className="border border-rule-quiet bg-panel px-4 py-3 text-sm text-ink-quiet">
                No transcript recorded for this call.
              </p>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="border border-rule bg-panel p-4">
            <h2 className="mb-3 font-serif text-base font-semibold text-ink">Follow-up</h2>
            {followUp ? (
              <form action={updateFollowUpAction} className="flex flex-col gap-3 text-sm">
                <input type="hidden" name="followUpId" value={followUp.id} />
                <input type="hidden" name="callId" value={call.id} />
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-quiet">Status</span>
                  <select
                    name="status"
                    defaultValue={followUp.status}
                    className="border border-rule bg-paper px-2 py-1.5 outline-none focus:border-ink"
                  >
                    {FOLLOW_UP_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-quiet">Notes</span>
                  <textarea
                    name="notes"
                    defaultValue={followUp.notes ?? ""}
                    rows={3}
                    className="border border-rule bg-paper px-2 py-1.5 outline-none focus:border-ink"
                  />
                </label>
                {followUp.dueAt && (
                  <p className="text-xs text-ink-quiet">Due {formatDateTime(followUp.dueAt)}</p>
                )}
                {followUp.completedAt && (
                  <p className="text-xs text-ink-quiet">Completed {formatDateTime(followUp.completedAt)}</p>
                )}
                <button type="submit" className="border border-ink bg-ink px-3 py-1.5 text-paper hover:bg-ink/90">
                  Save follow-up
                </button>
              </form>
            ) : (
              <p className="text-sm text-ink-quiet">No follow-up required for this call.</p>
            )}
          </section>

          {call.appointment && (
            <section className="border border-rule bg-panel p-4">
              <h2 className="mb-3 font-serif text-base font-semibold text-ink">Appointment</h2>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-quiet">Status</dt>
                  <dd className="text-ink">{titleCase(call.appointment.status)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-quiet">Requested</dt>
                  <dd className="text-ink">
                    {[call.appointment.requestedDate, call.appointment.requestedTime].filter(Boolean).join(" ") || "—"}
                  </dd>
                </div>
                {call.appointment.notes && <p className="text-ink-quiet">{call.appointment.notes}</p>}
              </dl>
            </section>
          )}

          {call.notifications.length > 0 && (
            <section className="border border-rule bg-panel p-4">
              <h2 className="mb-3 font-serif text-base font-semibold text-ink">Notifications sent</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {call.notifications.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2">
                    <span className="text-ink-quiet">
                      {titleCase(n.channel)} → {n.recipient}
                    </span>
                    <span className="text-ink">{titleCase(n.status)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
