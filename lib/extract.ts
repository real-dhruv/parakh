import { z } from "zod";
import { CHARGE_TYPES, PURITIES, type ChargeType, type Estimate } from "./schema";

// What the model returns: plain values + the exact slip text each came from. No "confirmed" flags —
// confirmation only ever comes from the user.
const V = z.object({ value: z.number().nullable(), source: z.string().nullable() });
const W = V.extend({ unit: z.enum(["g", "ct", "mg"]).nullable() });
const S = z.object({ value: z.string().nullable(), source: z.string().nullable() });

export const LlmEstimate = z.object({
  isJewelleryEstimate: z.boolean(),
  photoQuality: z.enum(["clear", "partly_unclear", "unreadable"]),
  shop: S,
  items: z.array(
    z.object({
      description: S,
      purity: z.object({ value: z.enum(PURITIES).nullable(), source: z.string().nullable() }),
      grossWt: W, stoneWt: W, netWt: W,
      hasStones: z.boolean().nullable(),
      goldRate: V, goldValue: V, lineTotal: V,
      charges: z.array(z.object({
        label: z.string(),
        typeGuess: z.enum(CHARGE_TYPES),
        basis: z.enum(["pct", "per_g", "flat"]).nullable(),
        rate: V, amount: V,
      })),
    }),
  ),
  subtotal: V, discount: V, gstPct: V, gstAmount: V, total: V,
  taxMode: z.enum(["exclusive", "inclusive", "unknown"]),
  saleType: z.enum(["retail_sale", "job_work", "unknown"]),
  huidMentioned: z.boolean().nullable(),
  unsure: z.array(z.string()),
});
export type LlmEstimate = z.infer<typeof LlmEstimate>;

export const EXTRACT_PROMPT = `You read Indian jewellery shop estimates / quotations / bills and transcribe them into JSON.

Rules — accuracy matters more than completeness:
- Transcribe only what is printed or written. NEVER compute, infer or guess a number. If a value is absent or you cannot read it with certainty, set value to null.
- "source" = the exact text of the line the value came from, as printed (keep the shop's own words, e.g. "Ghadai 600/gm 14,400"). null if value is null.
- Numbers: plain numbers without commas or ₹ ("1,18,125.00" → 118125). Weights keep their printed unit: grams "g", carats "ct" (diamonds are often in ct), milligrams "mg".
- goldRate is ₹ per gram. If the slip gives a rate per 10 g, divide by 10 and keep the original text in source.
- purity: one of ${PURITIES.join(", ")}. 22K = 916, 18K = 750, 14K = 585, 20K = 833, 23K = 958, 24K = 995 or 999. null if not stated. Use "unknown" only if a purity is written but you cannot map it.
- If only one weight is printed with no stones, put it in grossWt, leave netWt null, and set hasStones false. hasStones true if any stone/diamond weight or charge is listed; null if unclear.
- charges: every per-item line other than gold value (making, wastage/VA, stones/diamonds, hallmark, other, discounts). label = the slip's own wording. basis "pct" if given as a %, "per_g" if per gram, "flat" otherwise; rate = the % or per-gram number. Discounts are positive amounts with typeGuess "discount".
- lineTotal = the item's printed pre-GST amount, if printed.
- GST: if CGST + SGST (or IGST) are shown, gstPct = combined %, gstAmount = combined amount (source = one of the lines). If GST is split across several rates, gstPct null and gstAmount = total GST.
- discount = bill-level discount line, positive. taxMode "inclusive" if prices are stated as including GST, "exclusive" if GST is added on top, else "unknown".
- saleType "job_work" only if the customer supplied the gold and is paying for labour; "retail_sale" for a normal purchase; else "unknown".
- huidMentioned true if any HUID code is printed, false if none is printed.
- unsure: JSON paths of values you transcribed but are not fully certain about (e.g. "items.0.grossWt", "total").
- photoQuality: how reliably the whole slip can be read. isJewelleryEstimate false if this is not a jewellery estimate/bill.
Return only JSON matching the schema.`;

const jsonSchema = z.toJSONSchema(LlmEstimate);

export type ReadResult = { out: LlmEstimate; ms: number; costUsd: number | null; model: string };

export async function readWithOpenRouter(input: { imageDataUrl?: string; text?: string }, model: string): Promise<ReadResult> {
  const content: unknown[] = [{ type: "text", text: input.text ? `Estimate text:\n${input.text}` : "Read this estimate." }];
  if (input.imageDataUrl) content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  const messages: { role: string; content: unknown }[] = [{ role: "system", content: EXTRACT_PROMPT }, { role: "user", content }];

  const t0 = Date.now();
  let cost = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, messages, temperature: 0, usage: { include: true },
        response_format: { type: "json_schema", json_schema: { name: "estimate", strict: false, schema: jsonSchema } },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    cost += data.usage?.cost ?? 0;
    const text: string = data.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { parsed = undefined; }
    const v = LlmEstimate.safeParse(parsed);
    if (v.success) return { out: v.data, ms: Date.now() - t0, costUsd: cost || null, model };
    // One retry, telling the model what was wrong.
    messages.push({ role: "assistant", content: text }, { role: "user", content: `That JSON was invalid: ${v.error?.message.slice(0, 800) ?? "not JSON"}. Return corrected JSON only.` });
  }
  throw new Error("Could not read a valid estimate from the model output.");
}

/** Keyword fallback when Jev and the model are unavailable. */
export function keywordType(label: string): ChargeType | null {
  const l = label.toLowerCase();
  if (/disc|less|saved|off\b/.test(l)) return "discount";
  if (/wast|wst|\bva\b|value add|ghaat|ghat/.test(l)) return "wastage";
  if (/hallmark|huid|hm\b|certif/.test(l)) return "hallmark";
  if (/stone|dia|gem|kundan|polki|ruby|emerald|cz/.test(l)) return "stone";
  if (/making|\bmc\b|labou?r|ghadai|ghadhai|majuri|mazdoori/.test(l)) return "making";
  return null;
}

/** Model output → app Estimate. Nothing is confirmed until the user confirms it. */
export function toEstimate(o: LlmEstimate, chargeTypes?: (ChargeType | null)[]): Estimate {
  const unsure = new Set(o.unsure);
  const f = <T,>(x: { value: T | null; source: string | null }, path: string) => ({ value: x.value, source: x.value === null ? null : x.source, confirmed: false, unsure: unsure.has(path) });
  let k = 0;
  return {
    shop: f(o.shop, "shop"),
    items: o.items.map((it, i) => {
      const p = `items.${i}`;
      const wt = (x: z.infer<typeof W>, n: string) => ({ ...f(x, `${p}.${n}`), unit: x.unit });
      return {
        description: f(it.description, `${p}.description`),
        purity: f(it.purity, `${p}.purity`),
        grossWt: wt(it.grossWt, "grossWt"), stoneWt: wt(it.stoneWt, "stoneWt"), netWt: wt(it.netWt, "netWt"),
        hasStones: it.hasStones,
        goldRate: f(it.goldRate, `${p}.goldRate`), goldValue: f(it.goldValue, `${p}.goldValue`), lineTotal: f(it.lineTotal, `${p}.lineTotal`),
        charges: it.charges.map((c, j) => ({
          label: c.label,
          type: chargeTypes?.[k++] ?? c.typeGuess,
          basis: c.basis,
          rate: f(c.rate, `${p}.charges.${j}.rate`),
          amount: f(c.amount, `${p}.charges.${j}.amount`),
        })),
      };
    }),
    subtotal: f(o.subtotal, "subtotal"), discount: f(o.discount, "discount"),
    gstPct: f(o.gstPct, "gstPct"), gstAmount: f(o.gstAmount, "gstAmount"), total: f(o.total, "total"),
    taxMode: o.taxMode, saleType: o.saleType, huidMentioned: o.huidMentioned,
  };
}
