import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import { verifySharedSecret } from "@/lib/services/sharedSecretAuth";
import { listCalls, parseCallsListSearchParams } from "@/lib/services/callsQueryService";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// GET /api/calls — searchable, filterable, paginated call list (spec §39,
// §31). Same auth placeholder as /api/daily-summary: gated on
// x-internal-secret until dashboard session auth exists (Phase 5.1) — the
// dashboard's own pages read straight from callsQueryService server-side
// rather than calling this route, so this is for future external
// consumers, not the UI's data path.
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  if (!verifySharedSecret(request.headers.get("x-internal-secret"), getConfig().internalApiSecret)) {
    return NextResponse.json(
      { data: null, error: "Unauthorized", request_id: requestId },
      { status: 401 }
    );
  }

  const params = parseCallsListSearchParams(Object.fromEntries(request.nextUrl.searchParams));

  try {
    const result = await listCalls(getSupabaseAdmin(), params);
    return NextResponse.json({ data: result, error: null, request_id: requestId });
  } catch (error) {
    console.error(`[calls] ${requestId} failed:`, error);
    return NextResponse.json(
      { data: null, error: "Failed to list calls", request_id: requestId },
      { status: 500 }
    );
  }
}
