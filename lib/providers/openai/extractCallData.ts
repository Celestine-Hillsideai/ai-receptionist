import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { CallExtractionSchema, type CallExtraction } from "@/lib/domain/callTypes";
import type { LLMProvider } from "@/lib/providers/types";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

const EXTRACTION_SCHEMA_JSON = z.toJSONSchema(CallExtractionSchema);

// prompts/call-extraction.v1.md is the versioned prompt (spec §44) — do not
// edit it in place once used against real calls; add a v2 file instead and
// point PROMPT_PATH at it.
const PROMPT_PATH = join(process.cwd(), "prompts", "call-extraction.v1.md");

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * OpenAI-backed structured extraction (spec §21-23). Uses the Responses API
 * with a strict JSON schema derived directly from CallExtractionSchema, so
 * the schema the model is asked to follow and the schema we validate its
 * output against can never drift apart. Verified against live OpenAI calls
 * (model: gpt-5-mini, the config default) — correct structured output with
 * no fabrication. The request/response shape here
 * (endpoint, `text.format`, strict mode) is current as of when this was
 * written — re-verify against OpenAI's docs if calls start failing (spec §56).
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";

  async extractCallData(input: {
    transcript: string;
    callerPhone: string | null;
  }): Promise<CallExtraction> {
    const config = getConfig();
    if (!config.openaiApiKey) {
      throw new ExtractionError("OPENAI_API_KEY is not configured");
    }

    const systemPrompt = readFileSync(PROMPT_PATH, "utf-8");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: config.openaiExtractionModel,
          input: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Known caller phone number from the call platform (may be null if unavailable): ${input.callerPhone ?? "null"}\n\nTranscript:\n${input.transcript}`,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "call_extraction",
              strict: true,
              schema: EXTRACTION_SCHEMA_JSON,
            },
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ExtractionError("OpenAI request failed (network/timeout)", error);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ExtractionError(`OpenAI API returned ${response.status}: ${body.slice(0, 500)}`);
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    if (!outputText) {
      throw new ExtractionError("OpenAI response had no output text to parse");
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(outputText);
    } catch (error) {
      throw new ExtractionError("OpenAI output was not valid JSON", error);
    }

    // Never trust unvalidated LLM output (spec §75 Principle 3), even with
    // strict mode requested — validate before it goes anywhere near the DB.
    const validated = CallExtractionSchema.safeParse(rawJson);
    if (!validated.success) {
      throw new ExtractionError(`Extraction result failed schema validation: ${validated.error.message}`);
    }

    return validated.data;
  }
}

/** OpenAI Responses API payloads nest output text under output[].content[]; this is defensive against minor shape drift. */
function extractOutputText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === "string") return record.output_text;

  const output = record.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = (item as Record<string, unknown>)?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          const text = (part as Record<string, unknown>)?.text;
          if (typeof text === "string") return text;
        }
      }
    }
  }
  return null;
}
