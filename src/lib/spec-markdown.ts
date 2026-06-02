import type { FeatureSpec } from "@/types/spec";

export function specToMarkdown(spec: FeatureSpec): string {
  const lines: string[] = [`# ${spec.title}`, ""];
  for (const s of spec.sections) {
    lines.push(`## ${s.title}`, "", s.body.trim(), "", "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function slugifyFilename(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return (base || "spec") + ".md";
}
