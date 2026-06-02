import { NextResponse } from "next/server";
import { openAiRouteFailure } from "@/lib/openai-route-errors";
import { getLlmClient } from "@/lib/openai-server";
import { parseJsonFromModelText } from "@/lib/parse-json-response";
import type { FeatureSpec, SpecSection } from "@/types/spec";
import { randomUUID } from "crypto";

type RawSection = { title?: unknown; body?: unknown };
type RawSpec = { title?: unknown; sections?: unknown };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeSpec(raw: RawSpec): FeatureSpec {
  const title = isNonEmptyString(raw.title) ? raw.title.trim() : "Untitled spec";
  const sectionsIn = Array.isArray(raw.sections) ? raw.sections : [];
  const sections: SpecSection[] = sectionsIn
    .map((s): SpecSection | null => {
      if (!s || typeof s !== "object") return null;
      const o = s as RawSection;
      const st = isNonEmptyString(o.title) ? o.title.trim() : "";
      const body = isNonEmptyString(o.body) ? o.body.trim() : "";
      if (!st && !body) return null;
      return {
        id: randomUUID(),
        title: st || "Section",
        body,
      };
    })
    .filter((x): x is SpecSection => x !== null);

  if (sections.length === 0) {
    sections.push({
      id: randomUUID(),
      title: "Overview",
      body: "_No sections returned; try again or refine your feature description._",
    });
  }

  return { title, sections };
}

export async function POST(req: Request) {
  let feature: string;
  try {
    const body = (await req.json()) as { feature?: unknown };
    feature = typeof body.feature === "string" ? body.feature.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!feature) {
    return NextResponse.json({ error: "feature is required" }, { status: 400 });
  }

  try {
    const { client, model } = getLlmClient();

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a senior product engineer. Given a feature description, produce a structured implementation spec.

Return a single JSON object (valid json only, no markdown fences) with exactly these keys:
- "title": short spec title (string)
- "sections": array of objects, each with "title" (string) and "body" (string, GitHub-flavored Markdown)

Choose 5–12 sections appropriate to the feature. Prefer sections such as: Overview, Goals, User stories, Functional requirements, Non-goals, Data model, API / contracts, UI/UX notes, Edge cases & errors, Security & privacy, Observability, Testing strategy, Rollout / migration, Open questions. Only include sections that add real value; skip irrelevant ones.

Be concrete and actionable so an AI coding agent can implement from this spec.`,
        },
        { role: "user", content: feature },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }

    const parsed = parseJsonFromModelText(text) as RawSpec;
    const spec = normalizeSpec(parsed);
    return NextResponse.json(spec);
  } catch (e) {
    const { error, status } = openAiRouteFailure(e);
    return NextResponse.json({ error }, { status });
  }
}
