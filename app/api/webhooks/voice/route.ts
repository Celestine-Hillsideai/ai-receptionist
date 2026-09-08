import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { VoiceWebhookEventSchema } from "@/lib/domain/callTypes";
import { mapVapiEvent } from "@/lib/providers/vapi/mapEvent";
import { verifyVapiWebhookSecret } from "@/lib/services/webhookAuth";
import { upsertCallFromEvent } from "@/lib/services/callPersistence";
import { recordWebhookEvent } from "@/lib/services/idempotency";
import { triggerPostCallAnalysis } from "@/lib/services/n8nTrigger";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const PROVIDER = "vapi";

// POST /api/webhooks/voice — spec §17, §57.
//
// Contract: validate → verify auth → identify event → persist idempotently
// → respond fast. Long-running work (LLM extraction) happens in n8n,
// triggered here without blocking the response.
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  if (!verifyVapiWebhookSecret(request.headers.get("x-vapi-secret"))) {
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

  const parsed = VoiceWebhookEventSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(`[webhooks/voice] ${requestId} rejected malformed payload:`, parsed.error.message);
    return NextResponse.json(
      { data: null, error: "Malformed webhook payload", request_id: requestId },
      { status: 400 }
    );
  }

  const normalized = mapVapiEvent(parsed.data);
  if (!normalized) {
    // A Vapi message type we don't act on (transcript delta, function-call, etc.) — not an error.
    return NextResponse.json(
      { data: { status: "ignored" }, error: null, request_id: requestId },
      { status: 202 }
    );
  }

  const supabase = getSupabaseAdmin();

  let callId: string;
  try {
    callId = await upsertCallFromEvent(supabase, PROVIDER, normalized);
  } catch (error) {
    console.error(`[webhooks/voice] ${requestId} failed to persist call:`, error);
    return NextResponse.json(
      { data: null, error: "Failed to persist call", request_id: requestId },
      { status: 500 }
    );
  }

  let isNewEvent: boolean;
  try {
    ({ isNew: isNewEvent } = await recordWebhookEvent(supabase, {
      provider: PROVIDER,
      providerCallId: normalized.providerCallId,
      eventType: normalized.eventType,
      callId,
      rawPayload: parsed.data,
    }));
  } catch (error) {
    console.error(`[webhooks/voice] ${requestId} failed to record event:`, error);
    return NextResponse.json(
      { data: null, error: "Failed to record event", request_id: requestId },
      { status: 500 }
    );
  }

  if (isNewEvent && normalized.eventType === "end-of-call-report") {
    triggerPostCallAnalysis({ callId, providerCallId: normalized.providerCallId });
  }

  return NextResponse.json(
    { data: { status: "accepted", call_id: callId, duplicate: !isNewEvent }, error: null, request_id: requestId },
    { status: 200 }
  );
}
