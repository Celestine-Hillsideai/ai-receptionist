import { NextResponse } from "next/server";
import { getConfig, integrationStatus } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Readiness check (spec §37, §39): confirms the database is reachable and
// reports which optional provider integrations are currently configured,
// so missing config is observable rather than a silent failure later (§34).
export async function GET() {
  try {
    getConfig(); // throws if required env vars are missing
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Configuration error" },
      { status: 503 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { error: dbError } = await supabase.from("users").select("id").limit(1);

  if (dbError) {
    return NextResponse.json(
      { data: null, error: `Database not reachable: ${dbError.message}` },
      { status: 503 }
    );
  }

  return NextResponse.json({
    data: { status: "ready", integrations: integrationStatus() },
    error: null,
  });
}
