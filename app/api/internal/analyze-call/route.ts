import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { verifySharedSecret } from "@/lib/services/sharedSecretAuth";
import { analyzeCall, CallNotFoundError } from "@/lib/services/callAnalysisService";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// POST /api/internal/analyze-call — called by n8n's Workflow B trigger
// (spec §28), not by any external client. Runs LLM extraction + validation
// + business rules, all in application code per spec §4.3 rather than in
// n8n expressions, and persists the result. n8n then reads the response to
// decide which notification channel/workflow to invoke next.
const RequestSchema = z.object({ call_id: z.string() });

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  if (!verifySharedSecret(request.headers.get("x-internal-secret"), getConfig().internalApiSecret)) {
    return NextResponse.json(
      { data: null, error: "Unauthorized", request_id: requestId },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Malformed JSON body", request_id: requestId },
      { status: 400 }
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Expected { call_id: string }", request_id: requestId },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await analyzeCall(supabase, parsed.data.call_id);
    return NextResponse.json({ data: result, error: null, request_id: requestId }, { status: 200 });
  } catch (error) {
    if (error instanceof CallNotFoundError) {
      return NextResponse.json(
        { data: null, error: error.message, request_id: requestId },
        { status: 404 }
      );
    }
    console.error(`[internal/analyze-call] ${requestId} unexpected error:`, error);
    return NextResponse.json(
      { data: null, error: "Failed to analyze call", request_id: requestId },
      { status: 500 }
    );
  }
}
