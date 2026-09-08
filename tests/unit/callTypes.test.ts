import { describe, expect, it } from "vitest";
import { CallExtractionSchema } from "@/lib/domain/callTypes";

describe("CallExtractionSchema", () => {
  it("accepts a valid extraction result", () => {
    const result = CallExtractionSchema.safeParse({
      caller_name: "Jordan Reyes",
      organization: "Reyes Consulting",
      purpose: "Follow-up on Q3 proposal",
      message: "Wants a callback before Friday.",
      requested_action: "Call back",
      callback_requested: true,
      callback_number: "+15551234567",
      urgency_level: "high",
      urgency_reason: "Caller stated a Friday deadline",
      deadline: "2026-09-11T00:00:00Z",
      intent: "sales",
      follow_up_required: true,
      summary: "Callback requested before Friday.",
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid urgency_level (never trust unvalidated LLM output)", () => {
    const result = CallExtractionSchema.safeParse({
      caller_name: null,
      organization: null,
      purpose: null,
      message: null,
      requested_action: null,
      callback_requested: false,
      callback_number: null,
      urgency_level: "super-urgent",
      urgency_reason: null,
      deadline: null,
      intent: "general",
      follow_up_required: false,
      summary: null,
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence value outside [0, 1]", () => {
    const result = CallExtractionSchema.safeParse({
      caller_name: null,
      organization: null,
      purpose: null,
      message: null,
      requested_action: null,
      callback_requested: false,
      callback_number: null,
      urgency_level: "normal",
      urgency_reason: null,
      deadline: null,
      intent: "general",
      follow_up_required: false,
      summary: null,
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });
});
