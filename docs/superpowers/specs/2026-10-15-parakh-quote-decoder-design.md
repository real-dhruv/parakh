# Parakh — Jewellery Estimate "Second Opinion" — Design Spec

Date: 2026-10-15 · Status: awaiting review

## 1. Intent (agreed)

- **Outcome:** a working prototype for the BVP India Consumer AI Associate application that shows consumer insight, AI judgment and building ability, plus thesis docs and a Loom script.
- **Product:** a buyer-side "second opinion" on a jeweller's estimate. User uploads a photo (or pastes text) of an estimate slip → app extracts line items → deterministic code recalculates → shows what they are really paying for, red flags and questions to ask before paying. Optional comparison of 2–3 shops.
- **Who for:** Indian buyers making a high-value gold/diamond purchase at a physical jeweller (wedding, festival, gifting) who cannot decode making / wastage / stone / GST lines.
- **Name:** *Parakh* (Hindi: to assay / to examine).
- **Constraints:** clean-room (no employer code, data, pipelines or designs); synthetic data clearly labelled; no invented gold rates, statistics, testimonials or policies; secrets server-side only; spend cap ~$5 total (eval guard $2); ask before public deploy.
- **Success:** a BVP reviewer gets the value in 15 s; all numbers are correct and traceable to the slip; AI never authors a figure; production build passes; works on mobile.

## 2. User journey

1. **Home** — headline "Got a jewellery estimate? Get a second opinion before you pay." Actions: Upload photo · Paste text · Try a sample (3 synthetic slips, labelled "Synthetic sample").
2. **Confirm what we read** — extracted fields in an editable table; uncertain fields highlighted (from extractor `_uncertain` + Jev clarification decision). User can fix and continue. This is the grounding step.
3. **Report**
   - Stacked bar: metal · making · wastage/VA · stones · other · GST.
   - Three hidden numbers: implied gold rate (₹/g of the stated purity and ₹/g 24K-equivalent), effective making % of metal value, all-in cost per gram of fine gold.
   - Optional input: "Board rate shown in shop (₹/g, 22K)". Without it, no judgement on the rate.
   - Red flags with severity (`serious` / `ask` / `info`), each with a plain explanation and a "say this to the jeweller" line.
   - "Before you pay" checklist (HUID verify in BIS Care app, buyback/exchange terms, final weight on scale, itemised bill).
4. **Compare** — add 2–3 estimates; normalised table (fine-gold weight, ₹/g fine gold, making %, stones, GST) and an explanation of where the price gap comes from (deterministic decomposition; AI writes the sentence).

Out of scope: accounts, catalog, live gold-rate feed, Hindi UI, old-gold exchange valuation, persistence beyond the browser session.

## 3. Data model (`lib/schema.ts`, zod)

```ts
Purity = "24K" | "22K" | "18K" | "14K" | null          // fineness 0.999 / 0.916 / 0.750 / 0.585
ChargeType = "making" | "wastage" | "stone" | "hallmark" | "other" | "discount"
Charge = { label: string; type: ChargeType; basis?: "pct" | "per_g" | "flat"; rate?: number; amount: number }
Item = {
  description: string; purity: Purity;
  grossWt: number; stoneWt?: number; netWt?: number;  // grams
  goldRate?: number;                                   // ₹/g as written on slip
  goldValue?: number;                                  // ₹ as written
  charges: Charge[];
}
Estimate = {
  shop?: string; date?: string; items: Item[];
  subtotal?: number; gstPct?: number; gstAmount?: number; total: number;
  huidMentioned?: boolean; uncertain: string[];        // field paths the extractor was unsure of
}
```

Extractor output preserves the slip's raw labels (`Charge.label`); `type` is assigned by the label classifier.

## 4. Responsibilities

| Responsibility | Owner | Notes |
|---|---|---|
| Image/text → `Estimate` | OpenRouter vision model | JSON mode + zod validation, 1 retry with error feedback; failure → "couldn't read, paste text or enter manually" |
| Raw charge label → `ChargeType` | **Jev** `choice` | Fallback: keyword map, then OpenRouter |
| "Needs user confirmation before judging?" | **Jev** `choice` (`ok` / `confirm_fields`) + deterministic gaps (missing netWt, totals mismatch) | Confidence shown as a hint, never as correctness |
| Breakdown, implied rates, flags | Deterministic TS (`lib/calc.ts`, `lib/flags.ts`) | Unit-tested |
| Explanations + "say this" lines + compare sentence | OpenRouter text model | Input = computed facts JSON; output = text with placeholders like `{{flag.amount}}` filled by code; any digit sequence in model text not present in facts → regenerate once, else use template text |

If the eval shows Jev underperforms OpenRouter on a task, report it to the user before changing roles.

## 5. Calculations (`lib/calc.ts`)

- `fineness`: 24K 0.999, 22K 0.916, 18K 0.750, 14K 0.585.
- `netWt = netWt ?? grossWt − (stoneWt ?? 0)`.
- `goldValue = goldValue ?? goldRate × netWt` (if neither is present, the item is marked unverifiable).
- `impliedRate = goldValue / netWt`: what the buyer effectively pays per gram of actual metal. If this exceeds the written `goldRate`, extra weight was billed (feeds F3).
- `billedGoldWt = goldValue / goldRate` (only when both are present); F3 triggers when `billedGoldWt` is within tolerance of `grossWt` and `stoneWt > 0`.
- `rate24kEquiv = impliedRate / fineness`.
- `fineGoldWt = netWt × fineness`.
- `makingPct = (Σ making + Σ wastage amounts) / goldValue`.
- `costPerFineGram = total / Σ fineGoldWt` (gold items only).
- Rounding: compute in paise-free floats, display ₹ rounded to whole rupees; tolerance for mismatch = max(₹2, 0.1 %).

## 6. Flag rules (`lib/flags.ts`)

| # | Rule | Severity |
|---|---|---|
| F1 | Line sums / subtotal / GST / total don't reconcile (beyond tolerance) | serious |
| F2 | User board rate given and implied rate > board × 1.01 | serious |
| F3 | Gold billed on gross weight including stones (billed gold wt ≈ grossWt while stoneWt > 0) | serious |
| F4 | Making `per_g` or `pct` base uses grossWt while stoneWt > 0 | ask |
| F5 | Both wastage/VA and making charged | ask |
| F6 | GST ≠ 3 % of taxable value, or separate GST line on making | ask (phrased "verify") |
| F7 | Purity missing, or not 916/750/585/999 | ask |
| F8 | HUID not mentioned | info (BIS Care verify tip) |
| F9 | Effective making % reported as fact | info (no fair-range claim) |

Each flag: `{ id, severity, title, facts: Record<string, number|string>, amountAtStake?: number }`.

## 7. Synthetic samples & eval set

- `samples/*.html` → rendered to PNG via headless Chrome (`scripts/render-samples.ts`). 8 slips: printed POS, thermal receipt, handwritten-style font, Hinglish labels (e.g. "Ghadai", "VA"), diamond ring with stones, multi-item, one deliberately reconciling clean slip, one blurred photo.
- Fictional shop names; footer "SYNTHETIC — for demonstration".
- `samples/*.truth.json` = hand-checked `Estimate` + expected flag IDs.
- Labels set: ~40 charge strings with ground-truth `ChargeType`.

## 8. Eval (`eval/run.ts` → `EVAL.md`)

1. Extraction: 3 OpenRouter vision models (Gemini Flash class, GPT-4o-mini class, Claude Haiku class — exact IDs/prices checked at run time) × 8 slips. Metric: field-level accuracy on numeric fields (±0.5 %), flag-set match after calc, latency p50, cost.
2. Label classification: Jev vs best OpenRouter model on ~40 labels. Accuracy, latency, cost.
3. Clarification decision: Jev vs OpenRouter on clear vs blurred/ambiguous slips; metric = agreement with expected `ok/confirm`.
- Spend guard: abort when cumulative estimated cost > $2. Raw outputs saved under `eval/results/` (gitignored raw).

## 9. Architecture

Single Next.js (App Router) + TypeScript + Tailwind app.
- `app/page.tsx` home · `app/check/page.tsx` confirm+report (client state) · `app/compare/page.tsx`.
- `app/api/extract/route.ts` (image/text → Estimate + label types + clarification) · `app/api/explain/route.ts` (facts → text).
- `lib/openrouter.ts`, `lib/jev.ts` (thin fetch/SDK wrappers, server-only), `lib/schema.ts`, `lib/calc.ts`, `lib/flags.ts`.
- Env: `OPENROUTER_API_KEY`, `TYPESAFE_API_KEY`, `OPENROUTER_MODEL` (set from eval). `.env.example` committed, `.env.local` ignored.
- Rate limiting: simple in-memory per-IP cap on API routes (demo protection), image size ≤ 4 MB.
- If keys are absent: samples run on their precomputed truth JSON with a visible "Demo mode — AI not connected" banner; upload is disabled. Never presented as live AI.

## 10. Error handling

- Extraction invalid after retry → user-facing message + manual entry path.
- Jev/OpenRouter timeout (10 s) → fallback path (keyword map / template text), marked in UI as "basic mode".
- Non-jewellery image → extractor returns empty items → "This doesn't look like a jewellery estimate."

## 11. Testing & verification

- vitest: calc and flag rules against every `*.truth.json` (expected flags exact match) and hand-worked numeric cases.
- Grounding test: explanation output contains no number absent from facts.
- Manual: full demo flow in browser at 390 px and desktop; `next build` passes; grep build output and client bundle for key prefixes.

## 12. Deliverables beyond the app

`PRODUCT_THESIS.md`, `EVAL.md`, `INVESTMENT_THESIS.md`, `SUBMISSION.md` (Loom script 60–90 s, "What is it and who is it for?", one-line link description, technical explanation). Investment docs separate evidence (cited) from assumptions; no invented TAM/traction.
