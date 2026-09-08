import type { CallExtraction } from "@/lib/domain/callTypes";

// Deterministic business rules (spec §24) — never delegated to the LLM.
export type NotificationUrgency = "immediate" | "prompt" | "digest";

export interface BusinessRuleResult {
  notificationUrgency: NotificationUrgency;
  followUpRequired: boolean;
  createAppointment: boolean;
}

export function applyBusinessRules(extraction: CallExtraction): BusinessRuleResult {
  let notificationUrgency: NotificationUrgency = "digest";
  if (extraction.urgency_level === "critical") {
    notificationUrgency = "immediate";
  } else if (extraction.urgency_level === "high") {
    notificationUrgency = "prompt";
  }

  return {
    notificationUrgency,
    followUpRequired: extraction.callback_requested || extraction.follow_up_required,
    createAppointment: extraction.intent === "appointment",
  };
}
