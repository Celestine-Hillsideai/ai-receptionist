import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import { verifySharedSecret } from "@/lib/services/sharedSecretAuth";
import { getCallDetail } from "@/lib/services/callsQueryService";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// GET /api/calls/:id — full call detail (spec §39). See app/api/calls/route.ts
// for the shared auth placeholder note.
export async function GET(request: NextRequest, { params }: RouteContext<"/api/calls/[id]">) {
  const requestId = randomUUID();

  if (!verifySharedSecret(request.headers.get("x-internal-secret"), getConfig().internalApiSecret)) {
    return NextResponse.json(
      { data: null, error: "Unauthorized", request_id: requestId },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const call = await getCallDetail(getSupabaseAdmin(), id);
    if (!call) {
      return NextResponse.json(
        { data: null, error: "Call not found", request_id: requestId },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: call, error: null, request_id: requestId });
  } catch (error) {
    console.error(`[calls/${id}] ${requestId} failed:`, error);
    return NextResponse.json(
      { data: null, error: "Failed to load call", request_id: requestId },
      { status: 500 }
    );
  }
}
