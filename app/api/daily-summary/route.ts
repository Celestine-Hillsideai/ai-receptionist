import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import { verifySharedSecret } from "@/lib/services/sharedSecretAuth";
import { getDailySummary } from "@/lib/services/dailySummaryService";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// GET /api/daily-summary?date=YYYY-MM-DD (spec §39, §27). Defaults to today
// (UTC). Used by n8n's Workflow D (Daily Digest) and, later, the dashboard's
// Daily Summary page (spec §29).
//
// Auth: gated on the same x-internal-secret as /api/internal/* for now,
// since dashboard session auth doesn't exist yet (Phase 5). Once it does,
// this should accept an authenticated dashboard session too, not just the
// shared secret — it returns caller PII and shouldn't stay machine-only.
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  if (!verifySharedSecret(request.headers.get("x-internal-secret"), getConfig().internalApiSecret)) {
    return NextResponse.json(
      { data: null, error: "Unauthorized", request_id: requestId },
      { status: 401 }
    );
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  const date = dateParam ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { data: null, error: "date must be YYYY-MM-DD", request_id: requestId },
      { status: 400 }
    );
  }

  try {
    const summary = await getDailySummary(getSupabaseAdmin(), date);
    return NextResponse.json({ data: summary, error: null, request_id: requestId });
  } catch (error) {
    console.error(`[daily-summary] ${requestId} failed:`, error);
    return NextResponse.json(
      { data: null, error: "Failed to build daily summary", request_id: requestId },
      { status: 500 }
    );
  }
}
