import type { CanonicalEventType } from "@/lib/domain/callTypes";
import type { VoiceWebhookEvent } from "@/lib/domain/callTypes";

// Maps Vapi's raw message.type (+ status/endedReason) onto our canonical
// event types (spec §19). Vapi sends many message types we don't act on for
// the MVP (transcript deltas, function-call, tool-calls, speech-update,
// conversation-update, ...) — those map to `null` and the webhook route
// no-ops on them rather than erroring, since an unrecognized-but-harmless
// event type is not a client error.

export interface NormalizedVoiceEvent {
  eventType: CanonicalEventType;
  providerCallId: string;
  status: "in_progress" | "completed" | "failed";
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  recordingUrl: string | null;
  callerPhone: string | null;
  raw: unknown;
}

const FAILURE_ENDED_REASONS = new Set([
  "assistant-error",
  "pipeline-error",
  "unknown-error",
  "vonage-disconnected",
  "twilio-failed-to-connect-call",
  "call.start.error",
]);

function isFailureReason(endedReason: string | undefined): boolean {
  if (!endedReason) return false;
  return (
    FAILURE_ENDED_REASONS.has(endedReason) ||
    endedReason.includes("error") ||
    endedReason.includes("failed")
  );
}

function computeDurationSeconds(startedAt?: string, endedAt?: string): number | null {
  if (!startedAt || !endedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 1000);
}

function extractRecordingUrl(artifact: VoiceWebhookEvent["message"]["artifact"]): string | null {
  return artifact?.recording?.stereoUrl ?? artifact?.recording?.mono?.combinedUrl ?? null;
}

/**
 * Returns null for Vapi message types we don't map to a canonical call
 * lifecycle event (nothing to persist, respond 202 and stop).
 */
export function mapVapiEvent(event: VoiceWebhookEvent): NormalizedVoiceEvent | null {
  const { message } = event;
  const call = message.call;
  if (!call?.id) return null;

  const startedAt = call.startedAt ?? null;
  const endedAt = call.endedAt ?? null;
  const endedReason = message.endedReason ?? call.endedReason;
  const failed = isFailureReason(endedReason);

  let eventType: CanonicalEventType | null = null;
  let status: NormalizedVoiceEvent["status"] = "in_progress";

  switch (message.type) {
    case "status-update": {
      const rawStatus = message.status ?? call.status;
      if (rawStatus === "in-progress" || rawStatus === "ringing" || rawStatus === "forwarding") {
        eventType = "call.started";
        status = "in_progress";
      } else if (rawStatus === "ended") {
        eventType = failed ? "call.failed" : "call.ended";
        status = failed ? "failed" : "completed";
      }
      break;
    }
    case "end-of-call-report": {
      eventType = failed ? "call.failed" : "end-of-call-report";
      status = failed ? "failed" : "completed";
      break;
    }
    default:
      eventType = null;
  }

  if (!eventType) return null;

  return {
    eventType,
    providerCallId: call.id,
    status,
    startedAt,
    endedAt,
    durationSeconds: computeDurationSeconds(startedAt ?? undefined, endedAt ?? undefined),
    transcript: message.artifact?.transcript ?? null,
    recordingUrl: extractRecordingUrl(message.artifact),
    callerPhone: call.customer?.number ?? null,
    raw: event,
  };
}
