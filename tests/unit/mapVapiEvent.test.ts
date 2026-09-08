import { describe, expect, it } from "vitest";
import { mapVapiEvent } from "@/lib/providers/vapi/mapEvent";
import type { VoiceWebhookEvent } from "@/lib/domain/callTypes";

function event(overrides: Partial<VoiceWebhookEvent["message"]>): VoiceWebhookEvent {
  return {
    message: {
      type: "status-update",
      call: { id: "call-123", customer: { number: "+15551234567" } },
      ...overrides,
    },
  };
}

describe("mapVapiEvent", () => {
  it("maps an in-progress status-update to call.started", () => {
    const result = mapVapiEvent(
      event({ type: "status-update", status: "in-progress", call: { id: "call-123", startedAt: "2026-09-07T10:00:00Z" } })
    );
    expect(result?.eventType).toBe("call.started");
    expect(result?.status).toBe("in_progress");
    expect(result?.providerCallId).toBe("call-123");
  });

  it("maps a successful end-of-call-report with transcript and recording", () => {
    const result = mapVapiEvent(
      event({
        type: "end-of-call-report",
        call: { id: "call-123", startedAt: "2026-09-07T10:00:00Z", endedAt: "2026-09-07T10:03:00Z" },
        artifact: {
          transcript: "Receptionist: Hi. Caller: Hello.",
          recording: { stereoUrl: "https://cdn.example/call-123.wav" },
        },
      })
    );
    expect(result?.eventType).toBe("end-of-call-report");
    expect(result?.status).toBe("completed");
    expect(result?.transcript).toBe("Receptionist: Hi. Caller: Hello.");
    expect(result?.recordingUrl).toBe("https://cdn.example/call-123.wav");
    expect(result?.durationSeconds).toBe(180);
  });

  it("maps an end-of-call-report with a failure endedReason to call.failed", () => {
    const result = mapVapiEvent(
      event({ type: "end-of-call-report", endedReason: "pipeline-error", call: { id: "call-123" } })
    );
    expect(result?.eventType).toBe("call.failed");
    expect(result?.status).toBe("failed");
  });

  it("ignores message types we don't act on", () => {
    const result = mapVapiEvent(event({ type: "transcript" }));
    expect(result).toBeNull();
  });

  it("ignores events with no call id", () => {
    const result = mapVapiEvent({ message: { type: "end-of-call-report" } });
    expect(result).toBeNull();
  });
});
