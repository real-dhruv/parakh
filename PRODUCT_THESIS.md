# Parakh — Product Thesis

*A second opinion on your jewellery estimate, before you pay.*

## Target consumer
An Indian buyer making a high-value gold or diamond purchase at a physical jeweller: wedding sets, festival purchases (Akshaya Tritiya, Dhanteras), gifts for family. Often a one-off, high-stakes purchase where the buyer is not an expert and relies on trust in "our family jeweller".

## The pain
The decision is not made in a catalog. It is made at the counter, from an estimate slip that mixes gold rate, gross / net / stone weight, purity, making charges (percent, per gram or flat), wastage or "VA", stone charges, hallmarking and GST. Buyers can't easily tell:
- what they are paying for gold vs labour vs stones,
- whether stone weight was billed at the gold rate,
- whether two shops' quotes are comparable,
- what to ask before paying.

*(This is a hypothesis from domain familiarity and needs consumer validation. We have not run interviews.)*

## Existing alternatives
- **Ask the jeweller.** The party being evaluated is the one explaining.
- **Ask a relative.** Slow, and depends on who you know.
- **ChatGPT.** Can explain concepts, but leaves the user to transcribe the slip, does no verified arithmetic, and has no structured flags or cross-shop comparison.
- **Retailer apps (catalog-first).** Show their own prices, and have no incentive to decode a competitor's or local jeweller's bill.
- **Gold-rate apps / BIS Care.** Rates and HUID verification only; they don't read the bill.

## Why AI changes this
The input is an unstructured, often half-handwritten estimate, with shop-specific abbreviations ("MC", "VA", "Ghadai", "Wst"). Turning that into structured data used to need a human. Vision LLMs now do it in seconds at a fraction of a rupee per read. Once it is structured, ordinary code gives exact, auditable maths. AI reads and explains; code computes and judges.

## Differentiated capability
1. **Photo → audited breakdown** in seconds, with every figure traceable to a line on the slip.
2. **Hidden numbers made visible:** implied gold rate, effective making %, all-in cost per gram of fine gold.
3. **Rule-based red flags** with "say this to the jeweller" lines.
4. **Like-for-like comparison** across shops that bill differently.

## Business hypothesis (unvalidated)
- **Wedge:** free consumer tool, shared on WhatsApp during wedding and festival shopping.
- **Asset:** an anonymised, buyer-side record of real quotes across jewellers and cities, a pricing benchmark retailers won't publish themselves.
- **Revenue options to test:** lead generation to jewellers who opt into transparent pricing; "Parakh-verified" badge for jewellers; adjacent journeys (old-gold exchange valuation, gold loans, jewellery insurance).

## Most serious weaknesses and risks
- **Frequency:** jewellery purchases are infrequent, so retention is hard and acquisition must ride high-intent moments.
- **Counter friction:** will a buyer pull out a phone in front of a family jeweller? It may be used more *after* receiving an estimate, before returning to pay.
- **Jeweller hostility:** slips may become less itemised in response.
- **Accuracy liability:** a wrong flag could damage a legitimate business; flags must stay factual and phrased as questions.
- **Feature risk:** a large retailer or a general AI assistant could add "explain this bill".
- **Unproven pain intensity:** we don't yet know how many buyers feel cheated vs merely uncertain.

## What the prototype proves / doesn't prove
- **Proves:** extraction from realistic synthetic slips is feasible and cheap; deterministic checks catch the patterns we defined; the experience is understandable in 15 seconds.
- **Doesn't prove:** demand, willingness to use at the counter, accuracy on real-world slips, or any business model.
