import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { verifySharedSecret } from "@/lib/services/sharedSecretAuth";
import { recordNotification } from "@/lib/services/notificationService";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// POST /api/internal/record-notification — called by n8n's Workflow C
// (Immediate Notification) after attempting to send, so the `notifications`
// table (spec §25) stays the single source of truth even though the actual
// send happens inside n8n, not this app.
const RequestSchema = z.object({
  call_id: z.string(),
  channel: z.enum(["email", "whatsapp", "telegram", "sms", "teams", "slack"]),
  recipient: z.string(),
  status: z.enum(["queued", "sent", "failed"]),
  provider_message_id: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
});

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
      { data: null, error: parsed.error.message, request_id: requestId },
      { status: 400 }
    );
  }

  try {
    await recordNotification(getSupabaseAdmin(), {
      callId: parsed.data.call_id,
      channel: parsed.data.channel,
      recipient: parsed.data.recipient,
      status: parsed.data.status,
      providerMessageId: parsed.data.provider_message_id,
      errorMessage: parsed.data.error_message,
    });
    return NextResponse.json({ data: { status: "recorded" }, error: null, request_id: requestId });
  } catch (error) {
    console.error(`[internal/record-notification] ${requestId} failed:`, error);
    return NextResponse.json(
      { data: null, error: "Failed to record notification", request_id: requestId },
      { status: 500 }
    );
  }
}
