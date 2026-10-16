# Parakh — BVP Consumer AI submission

## D. One-line link description

> **Parakh:** photograph a jeweller's estimate and see what you're really paying for, which lines don't add up and what to ask before you pay. AI reads the slip; tested rules do every calculation.

## C. "What is it, and who is it for?"

> Parakh is a second opinion on a jewellery estimate, for Indian families buying gold at the counter for a wedding, a festival or a gift. Most of that decision happens on a half-handwritten slip mixing gold rate, gross and net weight, making, wastage, stones and GST. Snap the slip: a vision model transcribes every line and records where each number came from, you confirm it, and deterministic rules show the effective gold price, what doesn't add up, and the exact question to ask the jeweller. AI never writes a number in the report, and only arithmetic is ever called wrong.

(≈ 100 words. Shorter variant: *"A second opinion on a jewellery estimate for Indian families buying gold at the counter: snap the slip, confirm what AI read, and see what doesn't add up and what to ask before you pay."*)

## B. Loom script (≈ 80 seconds)

| Time | On screen | Say |
|---|---|---|
| 0:00–0:10 | Home page, sample slip on the right | "In India, most jewellery is bought across a counter from a slip like this: gold rate, gross and net weight, making, VA, stones, GST. Families decide lakhs of rupees on it, mostly on trust." |
| 0:10–0:20 | Tap **Try a sample** → reading screen | "Parakh gives a second opinion. I snap the estimate. A vision model on Groq reads it in about two and a half seconds." |
| 0:20–0:32 | Confirm screen, scroll a few rows | "Every number shows the exact slip line it came from, and nothing is judged until I confirm. That matters: in testing, one model read a handwritten 1 as a 7, which would have produced a false accusation." |
| 0:32–0:50 | Report top: "₹6,240 worth asking about" | "Then ordinary, tested code does the maths. The slip says ₹9,450 a gram, but I'm effectively paying ₹10,428, because the gold rate was applied to the stones' weight too. That's ₹5,670, plus ₹570 of making charged the same way." |
| 0:50–1:00 | Tap **Where these numbers come from** | "Every figure traces back to the slip. AI never writes a number here, and only arithmetic is ever called wrong. Everything else is a polite question to ask." |
| 1:00–1:20 | Back to home / scroll | "Why this could be a company: the habit already exists, since families share estimate photos on WhatsApp before deciding. Each report is shareable. And every check builds a buyer-side record of real making charges by city and item, which no retailer will publish. What I haven't proven yet is demand, accuracy on real slips, and how jewellers respond. Those are my next tests." |

Recording tips: phone-width browser window; use the "earrings for Mom" sample; record after one warm-up run so Groq responds in about 2.5 s.

## E. Technical explanation (tools, why, and what changed as a result)

**Built with Claude Code** as the engineering agent: I set the product thesis and the rules, it wrote and tested the code, and I reviewed every decision. Clean-room: all data is synthetic, shops are fictional, rates are illustrative.

| Layer | Tool | Why | Evidence |
|---|---|---|---|
| Read the photo | **Groq · `qwen/qwen3.8-27b`** | Best in eval, fast, free tier | 8/8 slips with exactly the right findings, 103/103 numbers exact, 2.5 s median |
| Fallback reader | **OpenRouter · Gemini 3.1 Flash Lite** | Kicks in when Groq is rate-limited | 8/8, 103/103, 3.6 s, ≈ $0.002 per slip |
| Read pasted text | **Groq · `openai/gpt-oss-20b`** | Text-only (rejects images, confirmed by test) | Live: read and sorted a text estimate in 1.6 s |
| Sort charge labels ("MC", "VA", "Ghadai", "Karigari"…) | **Jev (TypeSafe)** typed `choice` | Bounded classification with confidence | 44/44, against 43/44 for the best LLM and 33/44 for keyword rules |
| Every calculation and judgement | Plain TypeScript + zod | Money must be exact and auditable | 31 unit tests, incl. carats→grams, GST before/after prices, double-counted discounts |
| App | Next.js 16, Tailwind v4, design system in `design.md` | One deployable app | Production build passes; no keys in the browser bundle |

**What changed as a result of measuring instead of assuming:**
1. **Jev's role shrank to the job it wins.** It sorts labels (44/44). For photo clarity it added no signal over the reader model, so that second call was removed.
2. **The selection criterion became fidelity, not intelligence.** Claude Haiku "fixed" a slip whose total was ₹600 off by reporting the correct sum instead of the printed one, hiding exactly the error Parakh exists to catch. GPT-6 Luna misread handwriting (1 → 7). Both outcomes shaped the design: user confirmation before any judgement, and "doesn't add up" only on confirmed slip values.
3. **Bugs the eval caught in my own work:** uncapped response length made OpenRouter refuse calls under a $3 key limit; Anthropic rejected the JSON schema; two answer keys were wrong. All fixed and re-run.
4. Total eval spend: **about $0.12**.

**What the prototype does not prove:** demand, accuracy on real (non-synthetic) slips and phone photos, willingness to use it at the counter, or any revenue model. See `INVESTMENT_THESIS.md` § 8 for how each would be tested.

## A. Prototype link

_To add after deployment (needs your go-ahead; plan: Vercel free tier, keys as server-side environment variables, OpenRouter key spend limit kept at $3)._
