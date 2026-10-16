# Parakh — Eval results

Run: 2026-10-16 06:01 · total spend: $0.0052 · inputs: 8 slip images (7 synthetic + 1 blurred).
All inputs are synthetic. Small sample — treat as directional, not statistically significant.

## 1. Reading the slip (OpenRouter vision models)

| Model | Numeric fields exact | Missing left empty | Invented values | Review points exactly right | Median latency | Cost (all slips) | Failures |
|---|---|---|---|---|---|---|---|
| groq:qwen/qwen3.8-27b | 15/15 (100%) | 1/1 | 0 | 1/8 | 2.4 s | $0.0000 | 7 |
| anthropic/claude-haiku-5.5 | 0/0 (—) | 0/0 | 0 | 0/8 | 0.0 s | $0.0000 | 8 |
| openai/gpt-6-luna | 100/102 (98%) | 16/18 | 2 | 6/8 | 10.9 s | $0.0051 | 0 |
| google/gemini-3.1-flash-lite | 0/0 (—) | 0/0 | 0 | 0/8 | 0.0 s | $0.0000 | 8 |
| qwen/qwen3.8-flash | 0/0 (—) | 0/0 | 0 | 0/8 | 0.0 s | $0.0000 | 8 |
| google/gemini-3.8-flash | 0/0 (—) | 0/0 | 0 | 0/8 | 0.0 s | $0.0000 | 8 |
| openai/gpt-5.4-mini | 0/0 (—) | 0/0 | 0 | 0/8 | 0.0 s | $0.0000 | 8 |

**Chosen default:** `openai/gpt-6-luna` (most slips with exactly the right review points, then field accuracy, then cost).

## 2. Sorting charge labels (44 labels)

| Approach | Accuracy | Latency | Notes |
|---|---|---|---|
| Plain keyword rules (no AI) | 33/44 (75%) | ~0 ms | misses: Mkg, Lbr Chg, Banai, M.C. per gm, Karigari, Craftsmanship charges, V.A. 8%, Touch loss |
| Jev (choice) | 44/44 (100%) | 446 ms | 0 labels below 0.6 confidence; confidence on wrong answers: n/a; misses: none |
| openai/gpt-6-luna | 40/44 (91%) | 3120 ms | cost $0.0001224; misses: Navratna stones, Hallmark fee, Gift box, Round off (-) |

## 3. "Is this photo clear enough?"

| Slip | Expected | Jev (confidence) | Reader model |
|---|---|---|---|
| earrings-gift | clear | clear (1.00) | clear |
| clean-chain | clear | clear (1.00) | clear |
| diamond-ring | clear | clear (0.66) | clear |
| bangles-total | clear | clear (0.98) | clear |
| gst-on-making | clear | clear (1.00) | clear |
| pendant-inclusive | clear | clear (1.00) | clear |
| two-items-discount | clear | clear (1.00) | clear |
| earrings-gift-blurred | not clear | clear (0.91) | partly_unclear |

## Decision

_Filled in by hand after reading the numbers above._
