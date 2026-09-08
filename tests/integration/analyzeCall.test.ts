import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { analyzeCall, CallNotFoundError } from "@/lib/services/callAnalysisService";
import { getLLMProvider } from "@/lib/providers";

// Mocked (not just relying on OPENAI_API_KEY being absent) so this test
// stays deterministic regardless of ambient .env state — this dev
// environment now has a real key configured, so without mocking, this test
// would silently start making real OpenAI calls instead of testing the
// documented no-provider failure path (spec §58).
vi.mock("@/lib/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers")>();
  return { ...actual, getLLMProvider: vi.fn(actual.getLLMProvider) };
});

// Runs against the configured dev Supabase project (no isolated test DB
// exists yet — see docs/DATABASE.md). Skips itself if Supabase isn't
// configured, e.g. in an environment without .env.
const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!hasSupabase)("analyzeCall (integration)", () => {
  const supabase = getSupabaseAdmin();
  let callId: string;

  beforeAll(async () => {
    const { data, error } = await supabase
      .from("calls")
      .insert({
        provider: "test",
        provider_call_id: `analyze-call-test-${Date.now()}`,
        status: "completed",
        transcript: "Receptionist: Hi. Caller: Hello, this is a test call.",
      })
      .select("id")
      .single();
    if (error) throw error;
    callId = data.id;
  }, 30_000);

  afterAll(async () => {
    await supabase.from("call_analysis").delete().eq("call_id", callId);
    await supabase.from("calls").delete().eq("id", callId);
  });

  it("throws CallNotFoundError for an unknown call id", async () => {
    await expect(
      analyzeCall(supabase, "00000000-0000-0000-0000-000000000000")
    ).rejects.toBeInstanceOf(CallNotFoundError);
  });

  // When no LLM provider is available, extraction must fail cleanly (spec
  // §58) rather than fabricate data (spec Principle 1).
  it("records a failed analysis when no LLM provider is available, without touching the call record", async () => {
    vi.mocked(getLLMProvider).mockReturnValueOnce(null);

    const result = await analyzeCall(supabase, callId);

    expect(result.analysisStatus).toBe("failed");
    expect(result.analysisError).toContain("OPENAI_API_KEY");

    const { data: analysisRow } = await supabase
      .from("call_analysis")
      .select("analysis_status, analysis_error")
      .eq("call_id", callId)
      .single();
    expect(analysisRow?.analysis_status).toBe("failed");

    const { data: callRow } = await supabase
      .from("calls")
      .select("transcript, status")
      .eq("id", callId)
      .single();
    expect(callRow?.transcript).toBe("Receptionist: Hi. Caller: Hello, this is a test call.");
    expect(callRow?.status).toBe("completed");
  });
});
