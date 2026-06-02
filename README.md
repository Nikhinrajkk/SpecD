# SpecD

Next.js app that turns a **feature description** into a **dynamic Markdown spec**: multiple sections from an LLM, each editable and **AI-rewritable**, plus **download as `.md`**.

## Setup (free tier recommended)

```bash
cp .env.example .env.local
```

**Groq (free tier, no credit card for basic use):** create a key at [console.groq.com](https://console.groq.com), then in `.env.local`:

```env
GROQ_API_KEY=gsk_...
# optional — default llama-3.1-8b-instant (see Groq Models docs)
# GROQ_MODEL=llama-3.3-70b-versatile
```

If `GROQ_API_KEY` is set, SpecD uses Groq and **ignores** `OPENAI_API_KEY` for routing.

**OpenAI instead:** omit `GROQ_API_KEY` and set `OPENAI_API_KEY` (billing applies after free credits).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

- `POST /api/generate-spec` — `{ "feature": "..." }` → full spec (`title` + `sections[]` with ids).
- `POST /api/regenerate-section` — rewrites one section using the original feature, spec title, sibling sections, and an optional per-section hint.

Keys stay on the server; the browser only calls your Next routes.

## 429 / rate limits

- **Groq:** free tier has RPM/TPM caps — see Limits in the [Groq console](https://console.groq.com); wait or use a smaller model.
- **OpenAI:** often billing/quota — [Billing](https://platform.openai.com/account/billing), [Usage](https://platform.openai.com/usage).
