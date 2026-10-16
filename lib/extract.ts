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
- charges: every per-item line other than gold value (making, wastage/VA, stones/diamonds, hallmark, other, discounts). NEVER put GST / CGST / SGST / IGST / any tax in charges (tax goes only in gstPct / gstAmount), and NEVER put a total or subtotal line (Total, Jod, Kul, Amount, Taxable value) in charges. label = the slip's own wording. basis "pct" if given as a %, "per_g" if per gram, "flat" otherwise; rate = the % or per-gram number. Discounts are positive amounts with typeGuess "discount".
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

// OpenAI-compatible providers. Model refs look like "groq:<model>" or "openrouter:<model>" (bare = openrouter).
const PROVIDERS = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", key: () => process.env.GROQ_API_KEY, schemaMode: "json_object" as const },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", key: () => process.env.OPENROUTER_API_KEY, schemaMode: "json_schema" as const },
};
type Provider = keyof typeof PROVIDERS;

export function parseModelRef(ref: string): { provider: Provider; model: string } {
  const i = ref.indexOf(":");
  const p = i > 0 ? ref.slice(0, i) : "";
  return p in PROVIDERS ? { provider: p as Provider, model: ref.slice(i + 1) } : { provider: "openrouter", model: ref };
}
export const hasKey = (ref: string) => !!PROVIDERS[parseModelRef(ref).provider].key();

/** One JSON-mode chat call to any provider (used by the eval's label comparison). */
export async function chatJson(ref: string, prompt: string): Promise<{ json: unknown; costUsd: number | null }> {
  const { provider, model } = parseModelRef(ref);
  const cfg = PROVIDERS[provider];
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 2000, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return { json: JSON.parse(data.choices[0].message.content), costUsd: data.usage?.cost ?? null };
}

/** Reading order: READ_MODELS if set, else Groq (free tier) first, OpenRouter as fallback.
 *  Photos need a vision model; gpt-oss is text-only, so it handles pasted text. */
export function readChain(kind: "image" | "text"): string[] {
  const fromEnv = process.env.READ_MODELS?.split(",").map((x) => x.trim()).filter(Boolean);
  const groq = kind === "image" ? process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b" : process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const chain = fromEnv ?? [`groq:${groq}`, `openrouter:${process.env.OPENROUTER_MODEL || "google/gemini-3.1-flash-lite"}`];
  return chain.filter(hasKey);
}

export async function readEstimate(input: { imageDataUrl?: string; text?: string }, ref: string): Promise<ReadResult> {
  const { provider, model } = parseModelRef(ref);
  const cfg = PROVIDERS[provider];
  // Anthropic rejects schemas with many nullable unions, so it gets the schema in the prompt like Groq.
  const schemaMode = model.startsWith("anthropic/") ? "json_object" : cfg.schemaMode;
  const content: unknown[] = [{ type: "text", text: input.text ? `Estimate text:\n${input.text}` : "Read this estimate." }];
  if (input.imageDataUrl) content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  // json_object providers don't take a schema, so the schema goes in the prompt.
  const system = schemaMode === "json_object" ? `${EXTRACT_PROMPT}\n\nJSON schema:\n${JSON.stringify(jsonSchema)}` : EXTRACT_PROMPT;
  const messages: { role: string; content: unknown }[] = [{ role: "system", content: system }, { role: "user", content }];
  const response_format = schemaMode === "json_object"
    ? { type: "json_object" }
    : { type: "json_schema", json_schema: { name: "estimate", strict: false, schema: jsonSchema } };

  const t0 = Date.now();
  let cost = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0, max_tokens: 4000, response_format, ...(provider === "openrouter" ? { usage: { include: true } } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    cost += data.usage?.cost ?? 0; // Groq doesn't report cost; free-tier usage is recorded as null
    const text: string = data.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { parsed = undefined; }
    const v = LlmEstimate.safeParse(parsed);
    if (v.success) return { out: v.data, ms: Date.now() - t0, costUsd: cost || null, model: ref };
    // One retry, telling the model what was wrong.
    messages.push({ role: "assistant", content: text }, { role: "user", content: `That JSON was invalid: ${v.error?.message.slice(0, 800) ?? "not JSON"}. Return corrected JSON only.` });
  }
  throw new Error("Could not read a valid estimate from the model output.");
}

export const isTaxLabel = (label: string) => /\b(c|s|i|u)?gst\b|\btax\b|\bvat\b/i.test(label);
const isTotalLabel = (label: string) => /\b(sub\s*total|total|grand|jod|kul|net amount|amount|taxable|payable)\b/i.test(label);

/** Models sometimes file tax or total lines as item charges, which double-counts them and makes a
 *  correct slip look wrong. A "charge" that is tax, is labelled as a total, or equals a printed total
 *  is dropped. Idempotent; run before label classification so positions stay aligned. */
export function cleanCharges(o: LlmEstimate): LlmEstimate {
  const totals = [o.subtotal.value, o.total.value, o.gstAmount.value, ...o.items.flatMap((it) => [it.lineTotal.value, it.goldValue.value])]
    .filter((v): v is number => v !== null);
  for (const it of o.items) {
    it.charges = it.charges.filter((c) => {
      if (isTaxLabel(c.label) || isTotalLabel(c.label)) return false;
      const a = c.amount.value;
      return !(a !== null && c.typeGuess !== "discount" && totals.some((t) => Math.abs(t - a) <= 1));
    });
  }
  return o;
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
  cleanCharges(o);
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
        // Tax is bill-level only. A model that also lists GST as an item charge double-counts it and
        // would make a correct slip look wrong, so tax lines are dropped here whatever the model did.
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
