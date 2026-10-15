# Parakh — Jewellery Estimate "Second Opinion" — Design Spec v1.2

Date: 2026-10-15 · Status: awaiting review
v1.2 changes: tax-inclusive/exclusive handling, discount sign, retail-sale-only GST rule; all numeric statements templated (AI writes no numbers); accurate privacy wording; budget protection via provider-level key limit + per-IP rate limit (no in-memory "global" cap).
v1.1 changes: GST, purity, weight-unit and missing-value rules corrected; field provenance; flags downgraded to evidence-backed review points; comparison moved to stretch; privacy notice, global budget cap, session state; real-photo eval.

## 1. Intent (agreed)

- **Outcome:** a working prototype for the BVP India Consumer AI Associate application that shows consumer insight, AI judgment and building ability, plus thesis docs and a Loom script.
- **Product:** a buyer-side "second opinion" on a jeweller's estimate. Photo (or pasted text) of an estimate slip → AI extracts line items with their source text → user confirms → deterministic code recalculates → shows what they are paying for, what does not add up and what to ask before paying.
- **Who for:** Indian buyers making a high-value gold/diamond purchase at a physical jeweller (wedding, festival, gifting) who cannot decode making / wastage / stone / GST lines.
- **Name:** *Parakh* (Hindi: to assay / to examine).
- **Constraints:** clean-room (no employer code, data, pipelines or designs); synthetic data clearly labelled; no invented gold rates, statistics, testimonials or policies; secrets server-side only; spend cap ~$5 total (eval guard $2); ask before public deploy.
- **Success:** a BVP reviewer gets the value in 15 s; every figure traces to slip text + a shown calculation; AI never authors a figure; the app never labels a legitimate charge as wrong; production build passes; works on mobile.

**Core principle:** *Only arithmetic is provable from a slip. Everything else is a question to ask, with the ₹ amount involved.*

## 2. User journey (single estimate = core; comparison = stretch)

1. **Home** — "Got a jewellery estimate? Get a second opinion before you pay." Actions: Upload photo · Paste text · Try a sample (3 synthetic slips, labelled "Synthetic sample"). Privacy note before upload: "To read your estimate, the image is sent to an external AI service (via OpenRouter). Parakh keeps no copy on its server; your estimate is held only in this browser tab's session storage and cleared when you close it. Cover your name, phone and address before uploading."
2. **Confirm what we read** — extracted fields in an editable table. Each value shows the raw slip text it came from and its unit. Unreadable values are empty (never zero) and highlighted; the user fills or confirms them. Nothing is judged until required fields are confirmed.
3. **Report**
   - Stacked bar: metal · making · wastage/VA · stones · other · GST (only components that are known).
   - Key numbers: gold rate the bill implies (₹/g of net metal, at stated purity); making + wastage as % of metal value. **Tap any number → see the slip text it came from and the calculation.**
   - Optional: "Board rate in the shop" (₹ per g or per 10 g, with purity). Compared only when purity matches.
   - Review points in three tiers: **Doesn't add up** (arithmetic, provable) · **Ask the jeweller** (with ₹ at stake and a suggested question) · **Good to know** (tips).
   - "Before you pay" checklist: HUID verify in BIS Care app, final weight on the scale, exchange/buyback terms, itemised final invoice.
   - "Can't check" list: what was missing and why the app declined to compute it.
4. **Compare (stretch, only after 1–3 are done and verified)** — component-by-component table (metal value per net gram at same purity, making %, stones, GST). No single "all-in ₹/g" ranking across unlike items.

Out of scope: accounts, catalog, live gold-rate feed, Hindi UI, old-gold exchange valuation, server-side storage.
State: current estimate(s) kept in `sessionStorage` so navigation and refresh don't lose them.

## 3. Data model (`lib/schema.ts`, zod)

```ts
Purity = "24K999" | "24K995" | "23K" | "22K" | "20K" | "18K" | "14K" | "9K" | "unknown"
FINENESS = { "24K999": .999, "24K995": .995, "23K": .958, "22K": .916, "20K": .833, "18K": .750, "14K": .585, "9K": .375 }

Field<T> = { value: T | null; source: string | null; confirmed: boolean }   // source = raw slip text
WeightField = Field<number> & { unit: "g" | "ct" | "mg" | null }

ChargeType = "making" | "wastage" | "stone" | "hallmark" | "other" | "discount"
Charge = { label: string; type: ChargeType; basis: "pct" | "per_g" | "flat" | null;
           rate: Field<number>; amount: Field<number> }

Item = {
  description: Field<string>; purity: Field<Purity>;
  grossWt: WeightField; stoneWt: WeightField; netWt: WeightField;
  hasStones: boolean | null;
  goldRate: Field<number>;   // ₹/g as written (normalised from per-10g with note)
  goldValue: Field<number>;
  charges: Charge[];
}
Estimate = {
  shop: Field<string>; items: Item[];
  subtotal: Field<number>; discount: Field<number>;   // stored as a positive number, always subtracted
  gstPct: Field<number>; gstAmount: Field<number>; total: Field<number>;
  taxMode: "exclusive" | "inclusive" | "unknown";    // are line amounts before or after GST?
  saleType: "retail_sale" | "job_work" | "unknown";   // job_work = customer supplies the gold
  huidMentioned: boolean | null;
}
```

Rules: `null` means unknown. The extractor must not fill a value it cannot read. Ratings like "MC 12%" keep `basis` + `rate`.

## 4. Responsibilities

| Responsibility | Owner | Notes |
|---|---|---|
| Image/text → `Estimate` with source text per field | OpenRouter vision model | JSON mode + zod validation, 1 retry with error feedback; failure → paste/manual entry |
| Raw charge label → `ChargeType` | **Jev** `choice` | Fallback: keyword map → OpenRouter. Eval-gated |
| "Needs confirmation before judging?" | Deterministic required-field check + **Jev** `choice` on readability | Confidence shown only as a hint |
| Unit normalisation, breakdown, review points | Deterministic TS (`lib/calc.ts`, `lib/review.ts`) | Unit-tested |
| Every sentence containing a number | Deterministic templates in `lib/review.ts` | AI never produces numeric text |
| Short non-numeric context ("why this matters", tone-adapted suggested question) | OpenRouter text model | Output schema forbids digits (rejected if any digit appears → template fallback). Optional; report works fully without it |

If the eval shows Jev underperforms on a task, report to the user before changing roles.

## 5. Calculations (`lib/calc.ts`)

- Weight normalisation: `ct × 0.2 → g`, `mg ÷ 1000 → g`. Unknown unit on stone weight → unknown.
- `netWt`: use the slip's net weight if present; else `grossWt − stoneWtG` only if `stoneWt` known; else `grossWt` only if `hasStones === false`; otherwise **unknown** (dependent checks go to "Can't check").
- `goldValue`: slip value; else `goldRate × netWt` if both known; else unknown.
- `impliedRate = goldValue / netWt` (₹ per gram of net metal, at stated purity).
- `billedGoldWt = goldValue / goldRate` when both known.
- `metalSharePct = goldValue / total`; `makingPct = (Σ making + Σ wastage) / goldValue`.
- Charges: `discount`-type charges and `Estimate.discount` are subtracted (stored positive). 
- GST check base: `taxable = subtotal ?? (Σ goldValue + Σ non-discount charges − discounts)`.
- `taxMode = exclusive`: expected `gst = 3 % × taxable`, `total = taxable + gst`.
- `taxMode = inclusive`: expected `gst = total × 3/103`; check line sum = total.
- `taxMode = unknown`: try both; if exactly one reconciles, use it (shown as "assumed"); if neither, R1; if both ambiguous, GST check goes to "Can't check".
- The 3 % rule applies only when `saleType = retail_sale`. `job_work` or `unknown` → GST check skipped with explanation (job work on customer-supplied gold is taxed differently).
- Tolerance: max(₹2, 0.1 %) for money; max(0.01 g, 0.5 %) for weight.
- Board-rate input normalised to ₹/g; compared only if its purity equals the item's purity.
- No "total ÷ fine gold" metric anywhere.

## 6. Review points (`lib/review.ts`)

| # | Condition | Tier | Wording principle |
|---|---|---|---|
| R1 | Line items / subtotal / GST / total don't reconcile | Doesn't add up | Show both numbers and the difference |
| R2 | `gross − stone ≠ net` beyond tolerance (all three known) | Doesn't add up | Show the arithmetic |
| R3 | `billedGoldWt ≈ grossWt` while stone weight > 0 | Ask | "Gold appears charged on X g, which includes Y g of stones. Ask which weight the gold rate was applied to." ₹ at stake = rate × stone g |
| R4 | Making `per_g`/`pct` computed on gross weight while stones present | Ask | Same pattern |
| R5 | Board rate (same purity) given and `impliedRate > board × 1.01` | Ask | "₹Z/g above the board rate you entered. Ask what's included." |
| R6 | Retail sale only: GST ≠ 3 % of taxable value (per taxMode); or a 5 % rate applied to making | Ask | Cite: CBIC gems & jewellery FAQ — 3 % on total value incl. making, even if shown separately. A separate 3 % line is fine and not flagged |
| R7 | Both making and wastage/VA charged | Good to know | "Some jewellers charge both; ask what each covers." Not a fault |
| R8 | Purity missing/unknown | Ask | "Ask for purity in writing, e.g. 22K916." |
| R9 | HUID not mentioned | Good to know | BIS Care app verify tip |

No severity called "serious". No phrasing claims overcharging.

## 7. Synthetic samples & eval set

- `samples/*.html` → PNG via headless Chrome. 8 slips: printed POS, thermal receipt, handwritten-style font, Hinglish labels ("Ghadai", "VA", "Wst"), diamond ring with carat stone weight, multi-item, one fully clean slip (must produce zero Ask/Doesn't-add-up points), one blurred.
- Fictional shop names; footer "SYNTHETIC — for demonstration".
- `samples/*.truth.json`: hand-checked `Estimate` + expected review-point IDs. Truth values double-checked by a script independent of `lib/calc.ts`.
- **Real-photo set:** user photographs ~4 printed/on-screen samples with a phone (angle, glare, shadows).
- Label set: ~40 charge strings with ground-truth `ChargeType`.

## 8. Eval (`eval/run.ts` → `EVAL.md`)

1. Extraction: 3 OpenRouter vision models (exact IDs/prices checked at run time) on 8 rendered + ~4 phone photos. Metrics: numeric field accuracy (±0.5 %), "missing correctly left null" rate, hallucinated-value count, review-point set match, latency p50, cost.
2. Label classification: Jev vs best OpenRouter model on ~40 labels.
3. Confirmation decision: Jev vs OpenRouter on clear vs blurred/ambiguous inputs.
- Spend guard: abort at cumulative estimated $2.

## 9. Architecture

Single Next.js (App Router) + TypeScript + Tailwind app.
- `app/page.tsx` home · `app/check/page.tsx` confirm + report · `app/compare/page.tsx` (stretch).
- `app/api/extract/route.ts` · `app/api/explain/route.ts`.
- `lib/openrouter.ts`, `lib/jev.ts` (server-only), `lib/schema.ts`, `lib/calc.ts`, `lib/review.ts`.
- Env: `OPENROUTER_API_KEY`, `TYPESAFE_API_KEY`, `OPENROUTER_MODEL`. `.env.example` committed, `.env.local` ignored.
- Budget protection: (a) **primary** — hard spend limit on the OpenRouter key set in its dashboard (user action; enforced by the provider across all instances); same for TypeSafe if it offers one; (b) per-IP rate limit (best-effort, per instance — documented as such, not relied on); (c) image ≤ 4 MB, resized client-side; (d) one extraction call per estimate (no hidden loops beyond the single retry). A shared persistent counter (e.g. Upstash) is skipped; add if the demo link is shared widely.
- No keys: samples run on precomputed truth JSON with a visible "Demo mode — AI not connected" banner; upload disabled. Never presented as live AI.

## 10. Error handling

- Extraction invalid after retry → message + paste/manual entry.
- Jev/OpenRouter timeout (10 s) → keyword map / template text, marked "basic mode".
- Non-jewellery image → "This doesn't look like a jewellery estimate."
- Missing required values → item stays in "Can't check" with the reason; no guessed numbers.

## 11. Testing & verification

- vitest: calc + review rules against every truth JSON (exact review-point match), hand-worked cases, carat conversion, missing-value paths, clean-slip zero-flag case, GST separate-3 %-line not flagged, inclusive vs exclusive GST, discount subtracted, job-work skips GST rule.
- Grounding test: AI output containing any digit is rejected and replaced by template text.
- Manual: demo flow at 390 px and desktop; refresh keeps state; `next build` passes; client bundle grep for key prefixes.

## 12. Deliverables beyond the app

`PRODUCT_THESIS.md`, `EVAL.md`, `INVESTMENT_THESIS.md`, `SUBMISSION.md`. The investment thesis must state explicit, testable hypotheses for **frequency**, **distribution at the moment of purchase** and **defensibility vs ChatGPT/marketplaces**; evidence cited, assumptions labelled; no invented TAM or traction.

## 13. References

- CBIC gems & jewellery FAQ (Q7) via [TaxTMI](https://www.taxtmi.com/article/detailed?id=13416) — 3 % GST on total value incl. making.
- [BIS circular 23-07-2021](https://services.bis.gov.in/tmp/Circular_khfe_2021-07-23.pdf) — 20K/23K/24K added to IS 1417.
- [BIS hallmarking FAQ](https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/hallmarking-faq) — grades incl. 24KS (995).
- 9K (375): reported in 2025 by secondary sources; a second reviewer reports it in BIS LIMS listings. Kept in the model.
