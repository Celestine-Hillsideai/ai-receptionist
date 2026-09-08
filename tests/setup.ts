import { fileURLToPath } from "node:url";
import path from "node:path";

// Loads .env before tests run, so integration tests can reach the configured
// Supabase project. Unlike Next.js, Vitest doesn't load .env automatically.
try {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");
  process.loadEnvFile(envPath);
} catch {
  // .env not present (e.g. CI with real env vars injected some other way) — fine.
}
