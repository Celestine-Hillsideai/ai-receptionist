import { z } from "zod";

// Canonical, provider-independent call model (spec §14) and AI extraction
// schema (spec §22). These are the shapes every provider adapter normalizes
// into, and the shapes every LLM extraction result is validated against
// before it's trusted (spec §21, §75 Principle 3: never trust unvalidated
// LLM output).

export const URGENCY_LEVELS = ["low", "normal", "high", "critical"] as const;
export const INTENTS = [
  "general",
  "sales",
  "support",
  "partnership",
  "appointment",
  "complaint",
  "personal",
  "other",
] as const;
export const CALL_STATUSES = [
  "in_progress",
  "completed",
  "failed",
  "no_answer",
] as const;
export const FOLLOW_UP_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "not_required",
] as const;
export const APPOINTMENT_STATUSES = [
  "requested",
  "pending",
  "confirmed",
  "declined",
  "cancelled",
] as const;

/** Canonical internal event types every provider's raw events map into (spec §19). */
export const CANONICAL_EVENT_TYPES = [
  "call.started",
  "call.ended",
  "end-of-call-report",
  "call.failed",
] as const;
export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];

export const UrgencyLevel = z.enum(URGENCY_LEVELS);
export const Intent = z.enum(INTENTS);

/** Structured output the LLM extraction step must produce (spec §22), never trusted unvalidated. */
export const CallExtractionSchema = z.object({
  caller_name: z.string().nullable(),
  organization: z.string().nullable(),
  purpose: z.string().nullable(),
  message: z.string().nullable(),
  requested_action: z.string().nullable(),
  callback_requested: z.boolean(),
  callback_number: z.string().nullable(),
  urgency_level: UrgencyLevel,
  urgency_reason: z.string().nullable(),
  deadline: z.string().datetime({ offset: true }).nullable(),
  intent: Intent,
  follow_up_required: z.boolean(),
  summary: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type CallExtraction = z.infer<typeof CallExtractionSchema>;

/** Canonical call record (spec §14), independent of the voice provider. */
export const CanonicalCallSchema = z.object({
  call_id: z.string(),
  provider_call_id: z.string(),
  direction: z.literal("inbound"),
  channel: z.string(),
  status: z.enum(CALL_STATUSES),
  started_at: z.string().datetime({ offset: true }).nullable(),
  ended_at: z.string().datetime({ offset: true }).nullable(),
  duration_seconds: z.number().int().nonnegative().nullable(),

  caller: z.object({
    name: z.string().nullable(),
    organization: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }),

  purpose: z.string().nullable(),
  message: z.string().nullable(),
  requested_action: z.string().nullable(),

  callback: z.object({
    requested: z.boolean(),
    preferred_number: z.string().nullable(),
    deadline: z.string().datetime({ offset: true }).nullable(),
  }),

  urgency: z.object({
    level: UrgencyLevel,
    reason: z.string().nullable(),
    deadline: z.string().datetime({ offset: true }).nullable(),
  }),

  classification: z.object({
    intent: Intent,
    confidence: z.number().min(0).max(1),
  }),

  summary: z.string().nullable(),
  transcript: z.string().nullable(),

  follow_up: z.object({
    required: z.boolean(),
    status: z.enum(FOLLOW_UP_STATUSES),
    owner: z.string().nullable(),
  }),

  notifications: z.array(z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
});
export type CanonicalCall = z.infer<typeof CanonicalCallSchema>;

// Inbound Vapi webhook envelope. Vapi wraps every server event as
// `{ message: { type, call, artifact, endedReason, ... } }`; the exact set of
// fields present varies a lot by `type` (status-update, end-of-call-report,
// transcript, function-call, tool-calls, hang, ...), and several field names
// below (cost, duration, call.status enum) are inferred from Vapi's public
// docs/community sources rather than a schema we've seen a live payload
// against yet (spec §56: confirm against real traffic before fully trusting
// this). So this is deliberately loose (`.passthrough()` everywhere) — we
// validate only the shape we depend on and always keep the full raw body
// (spec §20), rather than rejecting anything we don't recognize.
const VapiCallSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
    endedReason: z.string().optional(),
    customer: z
      .object({
        number: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

const VapiArtifactSchema = z
  .object({
    transcript: z.string().optional(),
    recording: z
      .object({
        stereoUrl: z.string().optional(),
        mono: z
          .object({ combinedUrl: z.string().optional() })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .partial()
  .passthrough()
  .optional();

export const VoiceWebhookEventSchema = z.object({
  message: z
    .object({
      type: z.string(),
      call: VapiCallSchema.optional(),
      artifact: VapiArtifactSchema,
      endedReason: z.string().optional(),
      status: z.string().optional(),
    })
    .passthrough(),
});
export type VoiceWebhookEvent = z.infer<typeof VoiceWebhookEventSchema>;
