import { describe, expect, it } from "vitest";
import { applyBusinessRules } from "@/lib/services/businessRules";
import type { CallExtraction } from "@/lib/domain/callTypes";

function extraction(overrides: Partial<CallExtraction>): CallExtraction {
  return {
    caller_name: "Jordan Reyes",
    organization: "Reyes Consulting",
    purpose: "Follow-up",
    message: "Please call back.",
    requested_action: "Call back",
    callback_requested: false,
    callback_number: null,
    urgency_level: "normal",
    urgency_reason: null,
    deadline: null,
    intent: "general",
    follow_up_required: false,
    summary: "Test call",
    confidence: 0.8,
    ...overrides,
  };
}

describe("applyBusinessRules (spec §24, §42 required test cases)", () => {
  it("Test 1 — normal message: normal urgency, no forced follow-up", () => {
    const result = applyBusinessRules(extraction({}));
    expect(result.notificationUrgency).toBe("digest");
    expect(result.followUpRequired).toBe(false);
  });

  it("Test 2 — explicit callback request creates a follow-up", () => {
    const result = applyBusinessRules(extraction({ callback_requested: true }));
    expect(result.followUpRequired).toBe(true);
  });

  it("Test 3 — critical urgency triggers immediate notification", () => {
    const result = applyBusinessRules(extraction({ urgency_level: "critical", deadline: "2026-09-08T00:00:00Z" }));
    expect(result.notificationUrgency).toBe("immediate");
  });

  it("high urgency triggers prompt (not immediate) notification", () => {
    const result = applyBusinessRules(extraction({ urgency_level: "high" }));
    expect(result.notificationUrgency).toBe("prompt");
  });

  it("Test 4 — no callback requested does not force a follow-up on its own", () => {
    const result = applyBusinessRules(extraction({ callback_requested: false, follow_up_required: false }));
    expect(result.followUpRequired).toBe(false);
  });

  it("follow_up_required from extraction forces a follow-up even without a callback", () => {
    const result = applyBusinessRules(extraction({ callback_requested: false, follow_up_required: true }));
    expect(result.followUpRequired).toBe(true);
  });

  it("appointment intent flags an appointment to create", () => {
    const result = applyBusinessRules(extraction({ intent: "appointment" }));
    expect(result.createAppointment).toBe(true);
  });

  it("non-appointment intent does not flag an appointment", () => {
    const result = applyBusinessRules(extraction({ intent: "sales" }));
    expect(result.createAppointment).toBe(false);
  });
});
