import OpenAI from "openai";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export type LlmClient = {
  client: OpenAI;
  model: string;
  provider: "groq" | "openai";
};

/**
 * Prefer Groq when `GROQ_API_KEY` is set (free tier, no card for basic use).
 * Otherwise use OpenAI (`OPENAI_API_KEY`).
 */
export function getLlmClient(): LlmClient {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: GROQ_BASE,
      }),
      model,
      provider: "groq",
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) {
    throw new Error(
      "Set GROQ_API_KEY (free tier: https://console.groq.com) or OPENAI_API_KEY in .env.local",
    );
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  return {
    client: new OpenAI({ apiKey: openaiKey }),
    model,
    provider: "openai",
  };
}
