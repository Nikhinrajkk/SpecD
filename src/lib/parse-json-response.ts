/**
 * OpenAI sometimes wraps JSON in markdown fences; strip those before parsing.
 */
export function parseJsonFromModelText(text: string): unknown {
  let t = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(t);
  if (fence) t = fence[1].trim();
  return JSON.parse(t) as unknown;
}
