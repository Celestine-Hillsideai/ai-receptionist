import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";

// Server-only Supabase client using the service-role key. Never import this
// from a "use client" component or expose the key to the browser — it
// bypasses Row Level Security by design (spec §38 least-privilege guidance
// is enforced by keeping this client server-side only).

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const config = getConfig();
  cached = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
