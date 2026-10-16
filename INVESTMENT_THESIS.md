# Parakh — Investment Thesis (draft)

Labels used: **[Evidence]** = sourced fact · **[Built]** = shown by this prototype · **[Assumption]** = untested belief to validate. No market-size, revenue or traction figures are claimed; none have been measured.

## 1. What consumer behaviour could change?
Today a buyer at a jewellery counter accepts the estimate slip mostly on trust, or calls a relative. Parakh hypothesises a new habit: **photograph the estimate and get a second opinion before paying**, the way people now check reviews before booking a restaurant.
- [Assumption] Buyers already photograph estimates and share them on family WhatsApp groups for advice. Parakh turns that informal check into a structured one.

## 2. Why might consumers adopt it?
- [Assumption] The purchase is high-value, infrequent and emotionally loaded (weddings, festivals, gifts for parents), which is exactly when people want reassurance.
- [Built] The product needs nothing from the jeweller. A photo of the slip is enough, and the report gives concrete questions instead of verdicts, so using it doesn't feel confrontational.
- [Evidence] Regulation has already trained buyers to verify: since 1 April 2023, gold jewellery cannot be sold without a 6-digit HUID, which buyers can check in the BIS Care app ([Vikaspedia / Ministry of Consumer Affairs](https://vikaspedia.in/social-welfare/social-awareness/consumer-education/hallmarking-of-gold-jewelry-consumer-education-1/sale-of-hallmarked-gold-jewelry-or-gold-artefacts-without-huid-prohibited-after-31st-march-2023)). Purity is now verifiable; the *pricing* on the slip still isn't.

## 3. Why now?
- [Built] Vision LLMs can transcribe a messy, half-handwritten, Hinglish estimate into structured data in seconds: in `EVAL.md`, the chosen model read 8/8 synthetic slips exactly in about 2.5 s on a free tier, and the paid fallback costs about $0.002 per slip. Two years ago this needed a human.
- [Built] The judgement layer doesn't need AI: once the slip is structured, ordinary tested code checks it. That makes the product cheap to run and explainable.
- [Evidence] Clear public rules give the checks firm footing: 3% GST on the total value of a retail jewellery sale, including making ([CBIC gems & jewellery FAQ via TaxTMI](https://www.taxtmi.com/article/detailed?id=13416)), and defined BIS purity grades ([BIS FAQ](https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/hallmarking-faq)).

## 4. How might it acquire customers?
- [Assumption] **Moment-of-purchase sharing:** each report has a "Share with family" action; the family member who receives it is the next user. Test: share rate per report, and new users per shared report.
- [Assumption] **Seasonal intent:** wedding season, Akshaya Tritiya and Dhanteras are predictable high-intent windows for search and content ("how to read a jewellery bill").
- [Assumption] **Vernacular creators** who already explain gold pricing could use Parakh live on real slips.

## 5. How could it make money? (options to test, not a plan)
1. **Transparent-jeweller leads:** jewellers who agree to itemised, rule-compliant pricing get referred buyers. Their incentive is to win trust-sensitive customers.
2. **Adjacent journeys** at the same moment of trust: old-gold exchange valuation, gold loans and jewellery insurance (referral revenue).
3. **Benchmarks for the industry:** aggregated, anonymised making-charge ranges by city, purity and category (see §6).
- [Assumption] Consumers won't pay directly for a one-off check, so the model is likely B2B2C or referral-based.

## 6. What would make it hard to copy?
- **vs ChatGPT:** a general assistant reads one slip once. It doesn't know which charge patterns matter, can't guarantee its arithmetic, and keeps no memory across buyers. [Built] Parakh separates reading (AI) from judging (deterministic rules), so every figure traces back to a line on the slip.
- **vs jewellery brands and marketplaces:** they are on the seller side; decoding a competitor's or a local jeweller's bill conflicts with their own margins.
- [Assumption] **Data moat:** every checked estimate adds to a buyer-side record of real quotes (making %, wastage, stone pricing by city and item type). Over time this enables "is this making charge normal for this item in Jaipur?", a benchmark no retailer will publish. This is the core defensibility hypothesis and the hardest one to prove.

## 7. Largest commercial risks
- **Frequency:** individuals buy rarely, so retention depends on the family network and adjacent journeys, not repeat checks.
- **Counter friction:** buyers may not want to check in front of a family jeweller; usage may happen after the estimate, before returning to pay.
- **Jeweller response:** shops may make slips less itemised (fewer line items means less to check).
- **Liability and trust:** one wrong "doesn't add up" can hurt a legitimate business. [Built] Mitigated by design: only arithmetic on confirmed slip values is called inconsistent; everything else is a question.
- **Data-moat speed:** benchmarks only matter with dense data per city and category, which may take a long time to build.
- **Feature risk:** a large AI assistant or a jewellery platform could add "explain this bill".

## 8. Hypotheses to validate before investing
| # | Hypothesis | Cheapest test |
|---|---|---|
| H1 | Buyers feel real uncertainty at the counter, not just mild curiosity | 20 interviews with recent buyers; count who checked the bill with someone else |
| H2 | Buyers will photograph and check a slip before paying | Seasonal landing page + WhatsApp entry point; completion rate from upload to report |
| H3 | Reports get shared and bring in new users | Share rate; new users per shared report |
| H4 | AI reading holds up on real slips (not synthetic) | 100 consented real slips; field accuracy and false "doesn't add up" rate (target: zero false mismatches) |
| H5 | Some jewellers will pay for, or opt into, transparency | 10 jeweller conversations; LOIs for a "transparent pricing" listing |
| H6 | Quote data accumulates fast enough for credible city benchmarks | Checks per city per month during one wedding season |

## What this prototype proves, and what it doesn't
- **Proves [Built]:** a cheap model can read realistic synthetic slips (see `EVAL.md`); deterministic rules catch the defined patterns with zero false accusations on the test set; the core experience fits in about 15 seconds on a phone.
- **Doesn't prove:** demand, real-world slip accuracy, willingness to use at the counter, any revenue model, or the data moat.
