import { getConfig, integrationStatus } from "@/lib/config";

export const dynamic = "force-dynamic";

function IntegrationRow({ name, connected }: { name: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-rule-quiet py-2 text-sm">
      <span className="text-ink">{name}</span>
      <span
        className="rounded-sm px-1.5 py-0.5 text-xs font-medium"
        style={{
          color: connected ? "var(--status-done)" : "var(--ink-quiet)",
          backgroundColor: connected ? "var(--status-done-quiet)" : "var(--urgency-normal-quiet)",
        }}
      >
        {connected ? "Connected" : "Not configured"}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const config = getConfig();
  const integrations = integrationStatus();

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-quiet">
          Configuration is read from environment variables (spec §34) — change a value by updating the deployment&apos;s
          environment and redeploying, not from this page.
        </p>
      </header>

      <section className="mb-8 border border-rule bg-panel p-4">
        <h2 className="mb-3 font-serif text-base font-semibold text-ink">Office</h2>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between border-b border-rule-quiet py-2">
            <span className="text-ink-quiet">Environment</span>
            <span className="text-ink">{config.appEnv}</span>
          </div>
          <div className="flex items-center justify-between border-b border-rule-quiet py-2">
            <span className="text-ink-quiet">App URL</span>
            <span className="text-ink">{config.appUrl}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-ink-quiet">Secretary notification email</span>
            <span className="text-ink">{config.secretaryEmail ?? "Not set"}</span>
          </div>
        </div>
      </section>

      <section className="border border-rule bg-panel p-4">
        <h2 className="mb-3 font-serif text-base font-semibold text-ink">Integrations</h2>
        <IntegrationRow name="OpenAI (post-call extraction)" connected={integrations.openai} />
        <IntegrationRow name="Vapi (voice channel)" connected={integrations.vapi} />
        <IntegrationRow name="n8n (orchestration)" connected={integrations.n8n} />
        <IntegrationRow name="Email notifications" connected={integrations.email} />
        <IntegrationRow name="Google Calendar" connected={integrations.googleCalendar} />
      </section>

      <p className="mt-8 text-xs text-ink-quiet">
        Business hours, escalation rules, and user management (spec §5, §63-64) aren&apos;t built yet — this page
        currently reports status, it doesn&apos;t configure the system.
      </p>
    </div>
  );
}
