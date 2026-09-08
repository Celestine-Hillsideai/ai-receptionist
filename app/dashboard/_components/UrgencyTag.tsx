const URGENCY_COPY: Record<string, { label: string; color: string; quiet: string }> = {
  critical: { label: "Critical", color: "var(--urgency-critical)", quiet: "var(--urgency-critical-quiet)" },
  high: { label: "High", color: "var(--urgency-high)", quiet: "var(--urgency-high-quiet)" },
  normal: { label: "Normal", color: "var(--urgency-normal)", quiet: "var(--urgency-normal-quiet)" },
  low: { label: "Low", color: "var(--urgency-normal)", quiet: "var(--urgency-normal-quiet)" },
};

/** Urgency is always color AND text together — never color alone (spec §30 accessible typography). */
export function UrgencyTag({ level }: { level: string | null }) {
  if (!level) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-quiet">
        <span className="h-1.5 w-1.5 rounded-full bg-rule" aria-hidden />
        Pending
      </span>
    );
  }

  const copy = URGENCY_COPY[level] ?? URGENCY_COPY.normal;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium"
      style={{ color: copy.color, backgroundColor: copy.quiet }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: copy.color }} aria-hidden />
      {copy.label}
    </span>
  );
}

/** The colored left-edge flag on a call row — the ledger's "marked urgent" tab. */
export function UrgencyFlag({ level }: { level: string | null }) {
  const color =
    level === "critical" || level === "high"
      ? (URGENCY_COPY[level].color as string)
      : "transparent";
  return <span className="block h-full w-1 shrink-0 self-stretch" style={{ backgroundColor: color }} aria-hidden />;
}
