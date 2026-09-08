// Provider abstraction boundaries (spec §35). Application code depends only
// on these interfaces; concrete implementations live alongside them and are
// swapped via lib/providers/index.ts. This lets us build and test against
// mocks now and swap in Vapi/OpenAI/Resend/Google without touching callers.

import type { CallExtraction } from "@/lib/domain/callTypes";

export interface VoiceCallDetails {
  providerCallId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcript: string | null;
  callerPhone: string | null;
  raw: unknown;
}

/** Wraps the realtime voice AI platform (Vapi or equivalent). */
export interface VoiceProvider {
  readonly name: string;
  /** Fetch authoritative call details/transcript by provider call id, e.g. to reconcile a webhook. */
  fetchCallDetails(providerCallId: string): Promise<VoiceCallDetails>;
}

/** Wraps the LLM used for post-call structured extraction (spec §21-23). */
export interface LLMProvider {
  readonly name: string;
  extractCallData(input: {
    transcript: string;
    callerPhone: string | null;
  }): Promise<CallExtraction>;
}

export type NotificationChannel =
  | "email"
  | "whatsapp"
  | "telegram"
  | "sms"
  | "teams"
  | "slack";

export interface NotificationResult {
  status: "queued" | "sent" | "failed";
  providerMessageId: string | null;
  errorMessage: string | null;
}

/** Wraps a single outbound notification channel (spec §25). */
export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(input: {
    recipient: string;
    subject: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationResult>;
}

export interface AppointmentSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
}

/** Wraps calendar availability/booking (spec §12, future feature per §72). */
export interface CalendarProvider {
  readonly name: string;
  checkAvailability(slot: AppointmentSlot): Promise<boolean>;
  createEvent(slot: AppointmentSlot, details: Record<string, unknown>): Promise<{ eventId: string }>;
}

/** Wraps raw payload retention (spec §20). */
export interface StorageProvider {
  storeRawPayload(input: {
    provider: string;
    providerCallId: string;
    eventType: string;
    payload: unknown;
  }): Promise<{ reference: string }>;
}
