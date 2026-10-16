# Parakh

**A second opinion on a jewellery estimate, before you pay.**
Live prototype: **https://parakh-tan.vercel.app**

Photograph a jeweller's estimate slip. A vision model transcribes every line and records where each number came from; you confirm what it read; then plain, tested rules show what you're really paying for gold, making and stones, which lines don't add up, and the exact question to ask the jeweller.

Built for Indian families buying gold at the counter (weddings, festivals, gifts), where the decision happens on a half-handwritten slip, not in a catalog.

## How it works

| Step | What does it | Why |
|---|---|---|
| Read the photo | Groq · `qwen/qwen3.8-27b` (fallback: OpenRouter · Gemini 3.1 Flash Lite) | Best on the eval: 8/8 slips exactly right, 2.5 s |
| Read pasted text | Groq · `openai/gpt-oss-20b` | Text-only model, fast and free tier |
| Sort charge labels ("MC", "VA", "Ghadai"…) | Jev (TypeSafe) typed `choice` | 44/44, against 43/44 for the best LLM and 33/44 for keyword rules |
| Every calculation and judgement | TypeScript + zod (`lib/calc.ts`, `lib/review.ts`) | Money must be exact; the AI never writes a number in the report |

Only arithmetic on the slip's own confirmed figures is ever called wrong. Everything else is phrased as a question for the jeweller.

## Read more

- [`EVAL.md`](EVAL.md): model comparison, Jev vs LLM vs keyword rules, live browser test, and the bugs it found
- [`PRODUCT_THESIS.md`](PRODUCT_THESIS.md) · [`INVESTMENT_THESIS.md`](INVESTMENT_THESIS.md): the consumer insight, evidence vs assumptions, risks
- [`design.md`](design.md): the locked design system
- [`docs/superpowers/specs/`](docs/superpowers/specs/): the design spec and its revisions

## Run locally

```bash
npm install
cp .env.example .env.local   # add GROQ_API_KEY, OPENROUTER_API_KEY, TYPESAFE_API_KEY
npm run dev                  # http://localhost:3000 (without keys: clearly labelled demo mode)
npm test                     # 33 unit tests for the calculation and review rules
npm run eval                 # model + Jev evaluation → EVAL.md
```

All sample estimates are synthetic, shops are fictional and gold rates are illustrative. Independent clean-room project; built with Claude Code. Not financial, tax or legal advice.
