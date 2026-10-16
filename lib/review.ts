import { billDiscount, calcEstimate, known, moneyClose, slip, toGrams, weightClose, type EstimateCalc } from "./calc";
import type { Estimate, Item, Purity } from "./schema";

export type Tier = "mismatch" | "ask" | "tip";
export type ReviewPoint = {
  id: string; // rule id, e.g. "R3"
  tier: Tier;
  title: string;
  detail: string; // every number in here comes from a template, never from AI
  question?: string;
  atStake?: number;
  refs: string[]; // field paths, e.g. "items.0.goldValue", for source tracing
};
export type CantCheck = { what: string; why: string };
export type BoardRate = { ratePerG: number; purity: Purity };
export type Report = { calc: EstimateCalc; points: ReviewPoint[]; cantCheck: CantCheck[]; taxModeUsed: "exclusive" | "inclusive" | null; taxModeAssumed: boolean };

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const g = (n: number) => `${+n.toFixed(3)} g`;

const itemName = (it: Item, i: number) => it.description.value || `Item ${i + 1}`;
const titled = (single: boolean, name: string, t: string) => (single ? t.charAt(0).toUpperCase() + t.slice(1) : `${name}: ${t}`);

/** Pre-GST amount of an item using only slip-read values (S2). */
function slipItemAmount(it: Item): number | null {
  const lt = slip(it.lineTotal);
  if (lt !== null) return lt;
  const gv = slip(it.goldValue);
  const cs = it.charges.map((c) => slip(c.amount));
  if (gv === null || cs.some((c) => c === null)) return null;
  return it.charges.reduce((a, c, k) => a + (c.type === "discount" ? -cs[k]! : cs[k]!), gv);
}

export function review(e: Estimate, board?: BoardRate): Report {
  const calc = calcEstimate(e);
  const points: ReviewPoint[] = [];
  const cantCheck: CantCheck[] = [];

  e.items.forEach((it, i) => {
    const c = calc.items[i];
    const name = itemName(it, i);
    const T = (t: string) => titled(e.items.length === 1, name, t);
    const p = `items.${i}`;
    const rateS = slip(it.goldRate);
    const gvS = slip(it.goldValue);
    const grossS = toGrams(it.grossWt, slip);
    const stoneS = toGrams(it.stoneWt, slip);
    const netS = toGrams(it.netWt, slip) ?? (it.hasStones === false ? grossS : null);

    // R2: gross − stone = net (all three read from slip)
    if (grossS !== null && stoneS !== null && netS !== null && !weightClose(grossS - stoneS, netS)) {
      points.push({
        id: "R2", tier: "mismatch", title: T(`weights don't add up`),
        detail: `Gross ${g(grossS)} − stones ${g(stoneS)} = ${g(grossS - stoneS)}, but the slip shows net ${g(netS)}.`,
        question: "Can you re-weigh the piece and show me gross, stone and net weight?",
        refs: [`${p}.grossWt`, `${p}.stoneWt`, `${p}.netWt`],
      });
    }

    // R3: gold charged on gross weight that includes stones
    const rate = known(it.goldRate);
    const billedOnGross = c.billedGoldWt !== null && c.grossWtG !== null && c.stoneWtG !== null && c.stoneWtG > 0 && weightClose(c.billedGoldWt, c.grossWtG);
    if (billedOnGross && rate !== null) {
      points.push({
        id: "R3", tier: "ask", title: T(`gold rate may be applied to stone weight`),
        detail: `Gold value ${inr(c.goldValue!)} ÷ rate ${inr(rate)}/g = ${g(c.billedGoldWt!)}, which equals the gross weight including ${g(c.stoneWtG!)} of stones.`,
        question: "Which weight was the gold rate applied to — gross or net of stones?",
        atStake: rate * c.stoneWtG!,
        refs: [`${p}.goldValue`, `${p}.goldRate`, `${p}.grossWt`, `${p}.stoneWt`],
      });
    }

    // R1a: gold value = rate × net (slip values only); skip if R3 already explains it
    if (rateS !== null && gvS !== null && netS !== null && !billedOnGross && !moneyClose(gvS, rateS * netS)) {
      points.push({
        id: "R1", tier: "mismatch", title: T(`gold value doesn't match rate × weight`),
        detail: `${inr(rateS)}/g × ${g(netS)} = ${inr(rateS * netS)}, but the slip shows ${inr(gvS)} (difference ${inr(gvS - rateS * netS)}).`,
        question: "How was the gold value calculated?",
        refs: [`${p}.goldRate`, `${p}.netWt`, `${p}.goldValue`],
      });
    } else if (gvS !== null && (rateS === null || netS === null) && c.goldValueFrom === "slip" && !billedOnGross) {
      cantCheck.push({ what: `${name}: gold value`, why: "Gold rate or net weight wasn't on the slip (or not confirmed)." });
    }

    // R4: making on gross weight, or % that doesn't match gold value
    it.charges.forEach((ch, k) => {
      if (ch.type !== "making" && ch.type !== "wastage") return;
      const r = known(ch.rate);
      const amt = known(ch.amount);
      const ref = [`${p}.charges.${k}.rate`, `${p}.charges.${k}.amount`];
      if (r === null || amt === null) return;
      if (ch.basis === "per_g" && c.netWtG !== null && !moneyClose(amt, r * c.netWtG)) {
        if (c.grossWtG !== null && c.stoneWtG && moneyClose(amt, r * c.grossWtG)) {
          points.push({
            id: "R4", tier: "ask", title: T(`${ch.label} charged on gross weight`),
            detail: `${inr(r)}/g × gross ${g(c.grossWtG)} = ${inr(amt)}. On net metal weight (${g(c.netWtG)}) it would be ${inr(r * c.netWtG)}.`,
            question: `Is ${ch.label} charged on the stone weight too?`,
            atStake: amt - r * c.netWtG,
            refs: [...ref, `${p}.grossWt`, `${p}.stoneWt`],
          });
        } else if (slip(ch.rate) !== null && slip(ch.amount) !== null && c.netWtFrom === "slip") {
          points.push({
            id: "R1", tier: "mismatch", title: T(`${ch.label} doesn't match its rate`),
            detail: `${inr(r)}/g × ${g(c.netWtG)} = ${inr(r * c.netWtG)}, but the slip shows ${inr(amt)}.`,
            question: `How was ${ch.label} calculated?`,
            refs: [...ref, `${p}.netWt`],
          });
        }
      }
      if (ch.basis === "pct" && c.goldValue !== null && !moneyClose(amt, (r / 100) * c.goldValue)) {
        points.push({
          id: "R4", tier: "ask", title: T(`${ch.label} % doesn't match the gold value`),
          detail: `${r}% of the gold value ${inr(c.goldValue)} is ${inr((r / 100) * c.goldValue)}, but the slip shows ${inr(amt)}.`,
          question: `What is the ${r}% ${ch.label} applied to?`,
          atStake: amt - (r / 100) * c.goldValue,
          refs: [...ref, `${p}.goldValue`],
        });
      }
    });

    // R1b: printed line total vs its parts (slip values only)
    const lt = slip(it.lineTotal);
    const parts = gvS !== null && it.charges.every((ch) => slip(ch.amount) !== null)
      ? it.charges.reduce((a, ch) => a + (ch.type === "discount" ? -slip(ch.amount)! : slip(ch.amount)!), gvS) : null;
    if (lt !== null && parts !== null && !moneyClose(parts, lt)) {
      points.push({
        id: "R1", tier: "mismatch", title: T(`line total doesn't add up`),
        detail: `Gold ${inr(gvS!)} plus the charges listed comes to ${inr(parts)}, but the line total says ${inr(lt)}.`,
        question: "Can you walk me through the line total?",
        refs: [`${p}.goldValue`, `${p}.lineTotal`, ...it.charges.map((_, k) => `${p}.charges.${k}.amount`)],
      });
    }

    // R5: board rate (same purity only)
    const purity = it.purity.confirmed ? it.purity.value : null;
    const rateUsed = rate ?? c.impliedRate;
    if (board && rateUsed !== null) {
      if (purity !== board.purity) {
        cantCheck.push({ what: `${name}: rate vs board rate`, why: `Board rate you entered is for ${board.purity}; this item is ${purity ?? "unknown purity"}.` });
      } else if (rateUsed > board.ratePerG * 1.01) {
        points.push({
          id: "R5", tier: "ask", title: T(`rate is above the board rate you entered`),
          detail: `Rate used ${inr(rateUsed)}/g vs board ${inr(board.ratePerG)}/g (${inr(rateUsed - board.ratePerG)}/g more).`,
          question: "The board shows a lower rate — what's included in the rate on my bill?",
          atStake: c.netWtG !== null ? (rateUsed - board.ratePerG) * c.netWtG : undefined,
          refs: [`${p}.goldRate`, `${p}.goldValue`],
        });
      }
    }

    // R7: making + wastage both charged (common, informational)
    const hasMaking = it.charges.some((ch) => ch.type === "making");
    const hasWastage = it.charges.some((ch) => ch.type === "wastage");
    if (hasMaking && hasWastage) {
      points.push({
        id: "R7", tier: "tip", title: T(`both making and wastage/VA are charged`),
        detail: "Some jewellers charge both; others fold wastage into making. Neither is wrong by itself.",
        question: "What does each of these two charges cover?",
        refs: it.charges.map((ch, k) => (ch.type === "making" || ch.type === "wastage" ? `${p}.charges.${k}.amount` : "")).filter(Boolean),
      });
    }

    // R8: purity
    if (!purity || purity === "unknown") {
      points.push({
        id: "R8", tier: "ask", title: T(`purity isn't stated`),
        detail: "The slip doesn't state purity in a form like 22K916 or 18K750.",
        question: "Please write the purity on the bill, e.g. 22K916.",
        refs: [`${p}.purity`],
      });
    }
    if (c.netWtG === null) cantCheck.push({ what: `${name}: net metal weight`, why: "Net weight isn't on the slip and stone weight is unknown, so Parakh won't guess it." });
  });

  // Totals: subtotal, total, GST (slip-read values only for mismatch)
  const bdS = e.discount.source !== null ? billDiscount(e) : 0; // S1: deduped
  const subS = slip(e.subtotal);
  const totalS = slip(e.total);
  const gstS = slip(e.gstAmount);
  const itemAmts = e.items.map(slipItemAmount);
  if (subS !== null && itemAmts.every((a) => a !== null)) {
    const s = itemAmts.reduce<number>((a, x) => a + x!, 0);
    if (!moneyClose(s, subS)) {
      points.push({
        id: "R1", tier: "mismatch", title: "Items don't add up to the subtotal",
        detail: `The items add up to ${inr(s)}, but the subtotal says ${inr(subS)} (difference ${inr(subS - s)}).`,
        question: "Can you show me how the subtotal was added up?",
        refs: ["subtotal", ...e.items.map((_, i) => `items.${i}.lineTotal`)],
      });
    }
  }

  let taxModeUsed: Report["taxModeUsed"] = e.taxMode === "unknown" ? null : e.taxMode;
  let taxModeAssumed = false;
  if (subS !== null && totalS !== null) {
    const exclOk = gstS !== null && moneyClose(subS - bdS + gstS, totalS);
    const inclOk = moneyClose(subS - bdS, totalS);
    if (e.taxMode === "unknown" && exclOk !== inclOk) {
      taxModeUsed = exclOk ? "exclusive" : "inclusive";
      taxModeAssumed = true;
    }
    const ok = taxModeUsed === "exclusive" ? exclOk : taxModeUsed === "inclusive" ? inclOk : exclOk || inclOk;
    if (!ok && (taxModeUsed !== "exclusive" || gstS !== null)) {
      const expected = taxModeUsed === "inclusive" ? subS - bdS : subS - bdS + (gstS ?? 0);
      points.push({
        id: "R1", tier: "mismatch", title: "The final total doesn't add up",
        detail: `Subtotal ${inr(subS)}${bdS ? ` − discount ${inr(bdS)}` : ""}${taxModeUsed !== "inclusive" && gstS !== null ? ` + GST ${inr(gstS)}` : ""} = ${inr(expected)}, but the total says ${inr(totalS)} (difference ${inr(totalS - expected)}).`,
        question: "Can you show me how the final total was calculated?",
        refs: ["subtotal", "discount", "gstAmount", "total"],
      });
    }
  } else {
    cantCheck.push({ what: "Final total", why: "Subtotal or total wasn't read from the slip, so the total can't be independently checked." });
  }

  // R6: GST — retail jewellery sale is 3% of the total value incl. making (CBIC gems & jewellery FAQ)
  if (e.saleType !== "retail_sale") {
    cantCheck.push({ what: "GST rate", why: e.saleType === "job_work" ? "This looks like job work on your own gold, which is taxed differently from a retail sale." : "Parakh couldn't tell whether this is a retail sale; the 3% rule only applies to retail jewellery sales." });
  } else {
    const gstPct = known(e.gstPct);
    const gst = known(e.gstAmount);
    if (gstPct !== null && Math.abs(gstPct - 3) > 0.01) {
      points.push({
        id: "R6", tier: "ask", title: `GST shown as ${gstPct}%`,
        detail: "For a retail jewellery sale, GST is 3% of the total value including making charges (CBIC gems & jewellery FAQ).",
        question: `Why is GST ${gstPct}% instead of 3%?`,
        refs: ["gstPct"],
      });
    } else if (gst !== null) {
      const base = taxModeUsed === "inclusive" ? (calc.total !== null ? calc.total * (3 / 103) : null) : taxModeUsed === "exclusive" && calc.taxable !== null ? calc.taxable * 0.03 : null;
      if (base === null) {
        cantCheck.push({ what: "GST amount", why: "Couldn't tell whether prices are before or after GST, or the pre-GST value is missing." });
      } else if (!moneyClose(gst, base)) {
        points.push({
          id: "R6", tier: "ask", title: "GST amount isn't 3% of the value",
          detail: `3% GST on this bill would be ${inr(base)}; the slip shows ${inr(gst)}. A separately shown GST line is normal — the rate is what matters.`,
          question: "How was the GST amount calculated?",
          atStake: gst - base,
          refs: ["gstAmount", "subtotal", "total"],
        });
      }
    }
  }

  if (e.huidMentioned !== true) {
    points.push({
      id: "R9", tier: "tip", title: "HUID not on the slip",
      detail: "Every hallmarked gold piece carries a 6-digit HUID. You can verify it in the BIS Care app before paying.",
      question: "What is the HUID on each piece?",
      refs: [],
    });
  }

  const order: Record<Tier, number> = { mismatch: 0, ask: 1, tip: 2 };
  points.sort((a, b) => order[a.tier] - order[b.tier]);
  return { calc, points, cantCheck, taxModeUsed, taxModeAssumed };
}
