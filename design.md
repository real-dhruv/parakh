# Design — Parakh

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page; extend or amend this file when the
system needs to grow.

Context: an Indian buyer at a jeweller's counter, plus a reviewer who has 15 seconds.
One job: turn a photo of an estimate into "what to ask before you pay".
Tone: austere and trustworthy, an assay certificate or account ledger, not a shopping app.

## Genre
editorial

## Macrostructure family
- Marketing pages (`/`): **Split Studio**. Statement + actions on one half, proof (a real slip and what the rules found on it) on the other. Halves stack on mobile; the second split flips order.
- App pages (`/check` confirm + report): **Long Document**. One ruled column (≈ 34rem), numbered findings, ledger rows with right-aligned serif figures, inline disclosures for sources.
- Internal (`/slip/[id]`): renders synthetic sample images only; outside the system.

## Theme (custom: "assay certificate, ivory ledger, antique gold")
- `--color-paper`   oklch(97.8% 0.008 85)
- `--color-paper-2` oklch(99.3% 0.004 85)
- `--color-ink`     oklch(21% 0.008 60)
- `--color-ink-2`   oklch(46% 0.016 60)
- `--color-rule`    oklch(88.5% 0.013 80)
- `--color-accent`  oklch(62% 0.115 72); text uses `--color-accent-ink` oklch(44% 0.085 65)
- `--color-focus`   oklch(52% 0.16 255)
- Review tiers: mismatch oklch(50% 0.17 28) · ask oklch(52% 0.13 48) · tip oklch(45% 0.06 245)
- Axes: paper-band light · display high-contrast-serif · accent-hue warm

## Typography
- Display: Fraunces, weight 500 (wordmark 600), style normal. Never italic.
- Body: Instrument Sans, weight 400 / 600.
- Mono: JetBrains Mono. Only for text quoted from a slip (`slip: “…”`) and formulas.
- Figures: `tabular-nums lining-nums` (`.tnum`) on every amount.
- Type scale anchor: `--text-display` = clamp(2.25rem, 1.6rem + 3vw, 3.5rem)

## Spacing
4-point named scale in `tokens.css` (`--space-3xs` … `--space-3xl`). Use named tokens or Tailwind's 4-px multiples; no half steps.

## Motion
- Easings: `--ease-out`, `--ease-in`, `--ease-in-out`. Never the browser default `ease`.
- Reveal pattern: none. Pages are just there.
- One motion only: the scan line while the AI reads a slip. Reduced motion: static line.

## Microinteractions stance
- Silent success. The only confirmation is "Copied" on the share button when there's no native share sheet.
- Edits are inline and reversible (tap a value, Done). No confirmation dialogs.
- Unclear AI readings need an explicit tick ("Correct") or a fix before the report.

## CTA voice
- Primary: `.btn .btn-primary`. Ink fill, paper text, 10px radius, 52px min height, one line, verb-first ("Check my estimate", "Share with family").
- Secondary: `.btn .btn-secondary`. 1px ink outline, same shape.
- Tertiary: underlined text link in `--color-ink-2`.

## Honesty rules (product, not just design)
- No number in the UI is written by AI. Figures come from templates over computed facts.
- Only arithmetic on confirmed slip values may be called "Doesn't add up". Everything else is "Ask the jeweller".
- No unmeasured claims (latency, accuracy, savings). Samples are labelled synthetic.

## What pages MUST share
- Wordmark "Parakh" in Fraunces 600.
- Accent placement under 5% of any viewport.
- Display + body + mono fonts as above.
- CTA voice and hairline-ruled ledgers (`.ledger`) instead of cards. No card-in-card, no side stripes, no pill chips.

## What pages MAY differ on
- Macrostructure within the family (marketing vs app).
- Marketing pages may show real sample slip images as proof; app pages show the user's own slip only.

## Exports

### tokens.css
See `/tokens.css` (colour and font tokens are in a Tailwind `@theme static` block so utilities can read them; spacing, type, radius and easing are in `:root`). Plain-CSS equivalent:

```css
:root {
  --color-paper: oklch(97.8% 0.008 85);   --color-paper-2: oklch(99.3% 0.004 85);
  --color-ink: oklch(21% 0.008 60);       --color-ink-2: oklch(46% 0.016 60);
  --color-rule: oklch(88.5% 0.013 80);    --color-accent: oklch(62% 0.115 72);
  --color-accent-ink: oklch(44% 0.085 65); --color-focus: oklch(52% 0.16 255);
  --font-display: "Fraunces", Georgia, serif;
  --font-body: "Instrument Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --radius-input: 8px; --radius-button: 10px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```
