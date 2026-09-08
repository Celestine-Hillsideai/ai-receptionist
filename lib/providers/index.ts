import { getConfig } from "@/lib/config";
import { OpenAIProvider } from "@/lib/providers/openai/extractCallData";
import type { LLMProvider } from "@/lib/providers/types";

/** Returns null if no LLM provider is configured — callers must handle this (spec §58 LLM failure handling), never silently skip extraction. */
export function getLLMProvider(): LLMProvider | null {
  const config = getConfig();
  if (!config.openaiApiKey) return null;
  return new OpenAIProvider();
}
