"use client";

import { useCallback, useMemo, useState } from "react";
import type { FeatureSpec, SpecSection } from "@/types/spec";
import { slugifyFilename, specToMarkdown } from "@/lib/spec-markdown";

function newSection(partial?: Partial<SpecSection>): SpecSection {
  return {
    id: crypto.randomUUID(),
    title: partial?.title ?? "New section",
    body: partial?.body ?? "",
  };
}

export function SpecBuilder() {
  const [feature, setFeature] = useState("");
  const [spec, setSpec] = useState<FeatureSpec | null>(null);
  const [loading, setLoading] = useState<"generate" | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<Record<string, string>>({});

  const canGenerate = feature.trim().length > 0 && !loading;

  const generate = useCallback(async () => {
    setError(null);
    setLoading("generate");
    try {
      const res = await fetch("/api/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: feature.trim() }),
      });
      const data = (await res.json()) as FeatureSpec & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setSpec({ title: data.title, sections: data.sections });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }, [feature]);

  const regenerate = useCallback(
    async (sectionId: string) => {
      if (!spec) return;
      setError(null);
      setLoading(sectionId);
      try {
        const res = await fetch("/api/regenerate-section", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feature: feature.trim(),
            specTitle: spec.title,
            sections: spec.sections,
            targetId: sectionId,
            hint: hints[sectionId]?.trim() || undefined,
          }),
        });
        const data = (await res.json()) as {
          section?: SpecSection;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? res.statusText);
        }
        const next = data.section;
        if (!next) throw new Error("No section in response");
        setSpec((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sections: prev.sections.map((s) => (s.id === next.id ? next : s)),
          };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setLoading(null);
      }
    },
    [feature, hints, spec],
  );

  const updateSection = useCallback(
    (id: string, patch: Partial<Pick<SpecSection, "title" | "body">>) => {
      setSpec((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === id ? { ...s, ...patch } : s,
          ),
        };
      });
    },
    [],
  );

  const removeSection = useCallback((id: string) => {
    setSpec((prev) => {
      if (!prev) return prev;
      return { ...prev, sections: prev.sections.filter((s) => s.id !== id) };
    });
    setHints((h) => {
      const next = { ...h };
      delete next[id];
      return next;
    });
  }, []);

  const addSection = useCallback(() => {
    setSpec((prev) => {
      if (!prev) return { title: "Draft spec", sections: [newSection()] };
      return { ...prev, sections: [...prev.sections, newSection()] };
    });
  }, []);

  const downloadMd = useCallback(() => {
    if (!spec) return;
    const md = specToMarkdown(spec);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = slugifyFilename(spec.title);
    a.click();
    URL.revokeObjectURL(url);
  }, [spec]);

  const busy = loading !== null;
  const hintFor = useMemo(() => hints, [hints]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          SpecD
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Describe a feature. The app drafts a dynamic spec you can edit,
          regenerate per section (Groq free tier or OpenAI), and download as
          Markdown.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <label htmlFor="feature" className="text-sm font-medium text-foreground">
          Feature description
        </label>
        <textarea
          id="feature"
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          rows={5}
          placeholder="e.g. Add export to CSV on the reports page, with column picker and async email when the file is large…"
          className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-foreground outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-zinc-600"
          disabled={busy}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!canGenerate}
            className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading === "generate" ? "Generating…" : "Generate spec"}
          </button>
        </div>
      </section>

      {error ? (
        <p
          className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {spec ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1 space-y-1">
                <label
                  htmlFor="spec-title"
                  className="text-sm font-medium text-foreground"
                >
                  Spec title
                </label>
                <input
                  id="spec-title"
                  value={spec.title}
                  onChange={(e) =>
                    setSpec((prev) =>
                      prev ? { ...prev, title: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:ring-zinc-600"
                  disabled={busy}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addSection}
                  disabled={busy}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Add section
                </button>
                <button
                  type="button"
                  onClick={downloadMd}
                  disabled={busy}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Download .md
                </button>
              </div>
            </div>
          </section>

          <ul className="flex flex-col gap-6">
            {spec.sections.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <input
                    value={s.title}
                    onChange={(e) => updateSection(s.id, { title: e.target.value })}
                    className="w-full flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-foreground outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-zinc-600 sm:max-w-md"
                    disabled={busy}
                    aria-label="Section title"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void regenerate(s.id)}
                      disabled={busy || !feature.trim()}
                      className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading === s.id ? "AI…" : "AI rewrite"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(s.id)}
                      disabled={busy}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <label
                  htmlFor={`hint-${s.id}`}
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                >
                  Optional hint for AI rewrite
                </label>
                <input
                  id={`hint-${s.id}`}
                  value={hintFor[s.id] ?? ""}
                  onChange={(e) =>
                    setHints((h) => ({ ...h, [s.id]: e.target.value }))
                  }
                  placeholder="e.g. Mention idempotency and rate limits"
                  className="mb-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-zinc-600"
                  disabled={busy}
                />
                <label
                  htmlFor={`body-${s.id}`}
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                >
                  Body (Markdown)
                </label>
                <textarea
                  id={`body-${s.id}`}
                  value={s.body}
                  onChange={(e) => updateSection(s.id, { body: e.target.value })}
                  rows={10}
                  className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm leading-relaxed text-foreground outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-zinc-600"
                  disabled={busy}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
