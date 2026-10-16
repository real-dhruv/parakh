# Parakh — Eval results

Run: 2026-10-16 06:17 · total spend: $0.1121 · inputs: 8 slip images (7 synthetic + 1 blurred).
All inputs are synthetic. Small sample — treat as directional, not statistically significant.

## 1. Reading the slip (vision models via Groq and OpenRouter)

| Model | Numeric fields exact | Missing left empty | Invented values | Review points exactly right | Median latency | Cost (all slips) | Failures |
|---|---|---|---|---|---|---|---|
| groq:qwen/qwen3.8-27b | 103/103 (100%) | 16/17 | 1 | 8/8 | 2.5 s | $0.0000 | 0 |
| anthropic/claude-haiku-5.5 † | 99/103 (96%) | — | 1 | 6/8 | 9.0 s | ≈$0.01 | 0 |
| openai/gpt-6-luna | 101/103 (98%) | 16/17 | 1 | 7/8 | 11.6 s | $0.0046 | 0 |
| google/gemini-3.1-flash-lite | 103/103 (100%) | 14/17 | 3 | 8/8 | 3.6 s | $0.0179 | 0 |
| qwen/qwen3.8-flash | 101/103 (98%) | 15/17 | 2 | 8/8 | 30.9 s | $0.0089 | 0 |
| google/gemini-3.8-flash | 101/103 (98%) | 16/17 | 1 | 8/8 | 11.8 s | $0.0683 | 0 |
| openai/gpt-5.4-mini ‡ | 55/58 (95%) | 9/11 | 2 | 3/8 | 3.9 s | $0.0125 | 3 |

**Chosen default:** `groq:qwen/qwen3.8-27b` (most slips with exactly the right review points, then field accuracy, then cost).

† Re-run separately after a fix: Anthropic rejected the full JSON schema ("too many parameters with union types"), so Anthropic models now get the schema in the prompt. Its first run failed 8/8 for that reason.
‡ 3 failures were OpenRouter credit refusals near the key's $3 limit, not model errors.

**Reading the "invented values" column.** On inspection these were slip numbers filed in a *second* field, not made-up numbers. Example: on the one-item bangles slip, the printed sum "Jod 2,41,200" was also used as the item total; on a stone-free ring, the single printed weight was used as both gross and net. The answer keys left those fields empty, so the scorer counts them. No model produced a number that is not on the slip.

## 2. Sorting charge labels (44 labels)

| Approach | Accuracy | Latency | Notes |
|---|---|---|---|
| Plain keyword rules (no AI) | 33/44 (75%) | ~0 ms | misses: Mkg, Lbr Chg, Banai, M.C. per gm, Karigari, Craftsmanship charges, V.A. 8%, Touch loss |
| Jev (choice) | 44/44 (100%) | 581 ms | 0 labels below 0.6 confidence; confidence on wrong answers: n/a; misses: none |
| groq:qwen/qwen3.8-27b | 43/44 (98%) | 772 ms | cost $?; misses: Disc |

## 3. "Is this photo clear enough?"

| Slip | Expected | Jev (confidence) | Reader model |
|---|---|---|---|
| earrings-gift | clear | clear (1.00) | clear |
| clean-chain | clear | clear (1.00) | clear |
| diamond-ring | clear | clear (0.76) | clear |
| bangles-total | clear | clear (0.98) | clear |
| gst-on-making | clear | clear (1.00) | clear |
| pendant-inclusive | clear | clear (1.00) | clear |
| two-items-discount | clear | clear (1.00) | clear |
| earrings-gift-blurred | not clear | clear (0.89) | clear |

The blurred test slip was too mild: every reader still transcribed it exactly (15/15), so "clear" is arguably correct. This test does not separate Jev from the reader; a harder blur set is needed.

## Decision

**Photos → Groq `qwen/qwen3.8-27b`.** 8/8 slips with exactly the right review points, 103/103 numbers exact, 2.5 s median, free tier. Its limit is ~8k tokens/minute (about one slip per minute), fine for a demo but not for traffic.

**Fallback → OpenRouter `google/gemini-3.1-flash-lite`.** Also 8/8 and 103/103, 3.6 s, about $0.002 per slip. Used automatically when Groq is rate-limited or fails.

**Pasted text → Groq `openai/gpt-oss-20b`** (text-only; it rejects images, confirmed by test). Not scored here because this eval uses images.

**Charge labels → Jev.** 44/44, against 43/44 for the best LLM and 33/44 for keyword rules, at 581 ms in one call. Jev keeps this job.

**Photo clarity → reader model only.** Jev and the reader agreed on every slip, including the mild blur, so this test gives no reason for a second call. Jev was removed from this step to keep one decision per call; revisit with a harder blur set.

**What this shows about failure.** The handwritten diamond slip is where models slip: GPT-6 Luna read "7730" as "7330" and "24,195" as "24,795" in run 1. That would have produced a false "doesn't add up", which is why the user confirms every value before any judgement. Claude Haiku did something subtler on the bangles slip: it reported the arithmetically *correct* total instead of the printed one, hiding the ₹600 error. A reader that "fixes" the slip is worse than one that misreads it, so transcription fidelity, not general intelligence, is the selection criterion.

**Limits.** 8 synthetic slips; no real or phone-photographed slips yet. Directional only.

## 4. Live end-to-end test in a real browser (BrowserOS)

Run through the actual app, not the scoring script: samples via live AI, confirm, report, source trace, board-rate input, and pasted text.

| Check | Result |
|---|---|
| Earrings photo → report | Read by Groq Qwen in 2.5 s; ₹6,240 to ask about; effective ₹10,428/g vs ₹9,450/g on slip |
| Board rate ₹9,300/g entered | New point appears; total to ask rises to ₹7,110 (+₹150/g × 5.8 g = ₹870, correct) |
| Clean chain photo | "Nothing on this slip failed our checks." No false flags |
| Bangles photo (total ₹600 off) | "The final total doesn't add up … difference ₹600" |
| Pasted Hinglish text (gpt-oss-20b) | 2.7 s; stone-weight point found (₹4,725) |
| Groq rate-limited | Fell back to OpenRouter Gemini automatically; same values, 3.3 s |

**Bugs this found (all fixed, with tests where the logic is non-trivial):**
1. **False "doesn't add up" from mis-filed lines.** gpt-oss-20b listed GST, and on another run the subtotal ("Jod"), as item charges. That double-counted them and made a correct line look wrong, the worst failure Parakh can have. Fix: tax and total lines are dropped from charges in code for every model, the prompt forbids them, and users can remove any charge. After the fix, gpt-oss-20b passed all three pasted test estimates.
2. **Stale screens after "New check".** Next 16 keeps visited pages alive; the home page returned frozen on "Reading…", and a second check could reuse the first check's screen state. Fix: transient state resets when hidden; each check gets its own id.
3. **No upper bound on a slow read.** Now 20 s per provider and 45 s in the browser, with a plain message.
