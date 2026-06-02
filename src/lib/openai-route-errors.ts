import { APIError } from "openai";

const OPENAI_BILLING = "https://platform.openai.com/account/billing";
const OPENAI_USAGE = "https://platform.openai.com/usage";
const OPENAI_ERRORS = "https://platform.openai.com/docs/guides/error-codes/api-errors";
const GROQ_CONSOLE = "https://console.groq.com";

/**
 * Maps OpenAI SDK errors to HTTP responses for route handlers.
 * (Groq uses the same client shape, so errors are still `APIError`.)
 */
export function openAiRouteFailure(e: unknown): { error: string; status: number } {
  if (e instanceof APIError) {
    const status =
      typeof e.status === "number" && e.status >= 400 && e.status < 600
        ? e.status
        : 500;
    let error = e.message;
    if (status === 429) {
      error += [
        "",
        "429 usually means:",
        "• Groq: free-tier rate limits — wait or check Limits in " + GROQ_CONSOLE,
        "• OpenAI: billing / quota — " + OPENAI_BILLING + " · usage " + OPENAI_USAGE,
        "OpenAI error docs: " + OPENAI_ERRORS,
      ].join("\n");
    }
    return { error, status };
  }
  if (
    e instanceof Error &&
    (e.message.includes("GROQ_API_KEY") || e.message.includes("OPENAI_API_KEY"))
  ) {
    return { error: e.message, status: 503 };
  }
  return {
    error: e instanceof Error ? e.message : "Unknown error",
    status: 500,
  };
}
