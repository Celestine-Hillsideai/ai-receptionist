export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "alarm";
}) {
  return (
    <div className="border border-rule bg-panel px-4 py-3">
      <div
        className="font-mono text-3xl leading-none"
        style={{ color: tone === "alarm" && value > 0 ? "var(--urgency-critical)" : "var(--ink)" }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-sm text-ink-quiet">{label}</div>
    </div>
  );
}
