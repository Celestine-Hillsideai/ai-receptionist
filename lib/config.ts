// Central environment configuration. Reads process.env once, validates what's
// required for the app to boot, and reports missing config clearly (spec §34).
//
// Provider integrations (Vapi, OpenAI, email, Google) are optional at boot —
// their absence disables that provider's routes/workflows rather than crashing
// the app, since the MVP must run locally before every credential exists.

interface AppConfig {
  appEnv: string;
  appUrl: string;
  logLevel: string;

  supabaseUrl: string;
  supabaseServiceRoleKey: string;

  openaiApiKey: string | null;
  // Configurable rather than hardcoded: the "right" cheap/fast model shifts
  // over time (as of writing, gpt-5-mini — verify against your own OpenAI
  // account before relying on this, see lib/providers/openai/extractCallData.ts).
  openaiExtractionModel: string;

  vapiApiKey: string | null;
  vapiAssistantId: string | null;
  vapiWebhookSecret: string | null;

  n8nBaseUrl: string | null;
  n8nWebhookUrl: string | null;

  // Not part of the spec §34 env list — added to authenticate n8n's callback
  // into our internal endpoints (spec §38 server-side authorization applies
  // even to service-to-service calls). Same shared-secret pattern as
  // VAPI_WEBHOOK_SECRET.
  internalApiSecret: string | null;

  emailProvider: string | null;
  emailApiKey: string | null;
  emailFrom: string | null;
  secretaryEmail: string | null;

  googleClientId: string | null;
  googleClientSecret: string | null;
  googleRefreshToken: string | null;
}

// Required for the app to boot at all — everything else degrades gracefully.
const REQUIRED_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

function optional(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

function loadConfig(): AppConfig {
  const missing = REQUIRED_KEYS.filter((key) => !optional(key));
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill these in before starting the app.`
    );
  }

  return {
    appEnv: process.env.APP_ENV ?? "development",
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    logLevel: process.env.LOG_LEVEL ?? "info",

    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

    openaiApiKey: optional("OPENAI_API_KEY"),
    openaiExtractionModel: optional("OPENAI_EXTRACTION_MODEL") ?? "gpt-5-mini",

    vapiApiKey: optional("VAPI_API_KEY"),
    vapiAssistantId: optional("VAPI_ASSISTANT_ID"),
    vapiWebhookSecret: optional("VAPI_WEBHOOK_SECRET"),

    n8nBaseUrl: optional("N8N_BASE_URL"),
    n8nWebhookUrl: optional("N8N_WEBHOOK_URL"),
    internalApiSecret: optional("INTERNAL_API_SECRET"),

    emailProvider: optional("EMAIL_PROVIDER"),
    emailApiKey: optional("EMAIL_API_KEY"),
    emailFrom: optional("EMAIL_FROM"),
    secretaryEmail: optional("SECRETARY_EMAIL"),

    googleClientId: optional("GOOGLE_CLIENT_ID"),
    googleClientSecret: optional("GOOGLE_CLIENT_SECRET"),
    googleRefreshToken: optional("GOOGLE_REFRESH_TOKEN"),
  };
}

let cached: AppConfig | null = null;

/** Lazily loads and validates config. Throws on first call if required keys are missing. */
export function getConfig(): AppConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Which optional provider integrations currently have credentials configured. */
export function integrationStatus() {
  const c = getConfig();
  return {
    openai: c.openaiApiKey !== null,
    vapi: c.vapiApiKey !== null && c.vapiAssistantId !== null,
    n8n: c.n8nWebhookUrl !== null,
    email: c.emailApiKey !== null && c.emailFrom !== null,
    googleCalendar: c.googleClientId !== null && c.googleRefreshToken !== null,
  };
}
