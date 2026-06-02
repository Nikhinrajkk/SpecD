import { NextResponse } from "next/server";
import { openAiRouteFailure } from "@/lib/openai-route-errors";
import { getLlmClient } from "@/lib/openai-server";
import { parseJsonFromModelText } from "@/lib/parse-json-response";
import type { SpecSection } from "@/types/spec";

type Body = {
  feature?: unknown;
  specTitle?: unknown;
  sections?: unknown;
  targetId?: unknown;
  hint?: unknown;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const feature = typeof body.feature === "string" ? body.feature.trim() : "";
  const specTitle =
    typeof body.specTitle === "string" ? body.specTitle.trim() : "Spec";
  const targetId =
    typeof body.targetId === "string" ? body.targetId.trim() : "";
  const hint =
    typeof body.hint === "string" && body.hint.trim()
      ? body.hint.trim()
      : undefined;

  if (!feature || !targetId) {
    return NextResponse.json(
      { error: "feature and targetId are required" },
      { status: 400 },
    );
  }

  const sectionsIn = Array.isArray(body.sections) ? body.sections : [];
  const sections: SpecSection[] = sectionsIn
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const title = typeof o.title === "string" ? o.title : "";
      const b = typeof o.body === "string" ? o.body : "";
      if (!id) return null;
      return { id, title, body: b };
    })
    .filter((x): x is SpecSection => x !== null);

  const target = sections.find((s) => s.id === targetId);
  if (!target) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const othersSummary = sections
    .filter((s) => s.id !== targetId)
    .map((s) => `- **${s.title}** (${s.body.slice(0, 200)}${s.body.length > 200 ? "…" : ""})`)
    .join("\n");

  const userBlock = [
    `Feature request:\n${feature}`,
    "",
    `Spec title: ${specTitle}`,
    "",
    "Other sections (for consistency; do not repeat verbatim):",
    othersSummary || "(none)",
    "",
    `Regenerate only this section:\nTitle: ${target.title}\nCurrent body:\n${target.body}`,
    hint ? `\nUser hint for the rewrite:\n${hint}` : "",
  ].join("\n");

  try {
    const { client, model } = getLlmClient();

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You rewrite one section of a product spec. Return json only (no markdown fences) with keys "title" (string, may refine the section title) and "body" (string, GitHub-flavored Markdown). Keep scope to this section only; stay consistent with the feature and sibling sections.`,
        },
        { role: "user", content: userBlock },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }

    const parsed = parseJsonFromModelText(text) as {
      title?: unknown;
      body?: unknown;
    };
    const title = isNonEmptyString(parsed.title)
      ? parsed.title.trim()
      : target.title;
    const bodyMd = isNonEmptyString(parsed.body)
      ? parsed.body.trim()
      : target.body;

    const section: SpecSection = {
      id: target.id,
      title,
      body: bodyMd,
    };
    return NextResponse.json({ section });
  } catch (e) {
    const { error, status } = openAiRouteFailure(e);
    return NextResponse.json({ error }, { status });
  }
}
