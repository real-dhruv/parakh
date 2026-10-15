import { FINENESS, type Estimate, type Item, type NumField, type WeightField } from "./schema";

/** Confirmed value, whether read from the slip or typed by the user. */
export const known = (f: NumField): number | null => (f.confirmed && f.value !== null ? f.value : null);
/** Confirmed value that was read from the slip itself (S2: only these can prove an inconsistency). */
export const slip = (f: NumField): number | null => (f.source !== null ? known(f) : null);

export const toGrams = (f: WeightField, from = known): number | null => {
  const v = from(f);
  if (v === null) return null;
  if (f.unit === "ct") return v * 0.2;
  if (f.unit === "mg") return v / 1000;
  if (f.unit === "g") return v;
  return null; // unknown unit → unknown weight
};

export const moneyClose = (a: number, b: number) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * 0.001);
export const weightClose = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.005);
const sum = (xs: (number | null)[]) => (xs.some((x) => x === null) ? null : xs.reduce<number>((a, x) => a + (x as number), 0));

export type ItemCalc = {
  grossWtG: number | null;
  stoneWtG: number | null;
  netWtG: number | null;
  netWtFrom: "slip" | "gross-stone" | "gross-no-stones" | null;
  goldValue: number | null;
  goldValueFrom: "slip" | "rate×net" | null;
  fineness: number | null;
  impliedRate: number | null; // ₹ per gram of net metal at stated purity
  billedGoldWt: number | null; // goldValue / goldRate
  making: number | null;
  wastage: number | null;
  stone: number | null;
  other: number | null;
  discount: number | null;
  lineAmount: number | null; // pre-GST: gold + charges − discounts
};

export function calcItem(it: Item): ItemCalc {
  const grossWtG = toGrams(it.grossWt);
  const stoneWtG = toGrams(it.stoneWt) ?? (it.hasStones === false ? 0 : null);
  let netWtG = toGrams(it.netWt);
  let netWtFrom: ItemCalc["netWtFrom"] = netWtG !== null ? "slip" : null;
  if (netWtG === null && grossWtG !== null && toGrams(it.stoneWt) !== null) {
    netWtG = grossWtG - (toGrams(it.stoneWt) as number);
    netWtFrom = "gross-stone";
  } else if (netWtG === null && grossWtG !== null && it.hasStones === false) {
    netWtG = grossWtG;
    netWtFrom = "gross-no-stones";
  }

  const rate = known(it.goldRate);
  let goldValue = known(it.goldValue);
  let goldValueFrom: ItemCalc["goldValueFrom"] = goldValue !== null ? "slip" : null;
  if (goldValue === null && rate !== null && netWtG !== null) {
    goldValue = rate * netWtG;
    goldValueFrom = "rate×net";
  }

  const byType = (...types: string[]) => {
    const cs = it.charges.filter((c) => types.includes(c.type));
    return cs.length ? sum(cs.map((c) => known(c.amount))) : 0;
  };
  const making = byType("making");
  const wastage = byType("wastage");
  const stone = byType("stone");
  const other = byType("hallmark", "other");
  const discount = byType("discount");
  const p = it.purity.confirmed ? it.purity.value : null;
  const fineness = p && p !== "unknown" ? FINENESS[p] : null;

  return {
    grossWtG, stoneWtG, netWtG, netWtFrom, goldValue, goldValueFrom, fineness,
    impliedRate: goldValue !== null && netWtG ? goldValue / netWtG : null,
    billedGoldWt: goldValue !== null && rate ? goldValue / rate : null,
    making, wastage, stone, other, discount,
    lineAmount: goldValue === null ? null : sum([goldValue, making, wastage, stone, other, discount === null ? null : -discount]),
  };
}

/** S1: a bill-level discount that just summarises item-level discount lines is counted once. */
export function billDiscount(e: Estimate): number {
  const d = known(e.discount);
  if (d === null) return 0;
  const itemDiscounts = e.items.flatMap((it) => it.charges.filter((c) => c.type === "discount"));
  if (!itemDiscounts.length) return d;
  const sameSource = itemDiscounts.some((c) => c.amount.source !== null && c.amount.source === e.discount.source);
  const amounts = itemDiscounts.map((c) => known(c.amount) ?? 0);
  const sameTotal = moneyClose(d, amounts.reduce((a, x) => a + x, 0));
  return sameSource || sameTotal || amounts.some((a) => moneyClose(d, a)) ? 0 : d;
}

export type EstimateCalc = {
  items: ItemCalc[];
  components: { metal: number | null; making: number | null; wastage: number | null; stones: number | null; other: number | null; discount: number | null; gst: number | null };
  itemsSum: number | null; // Σ line amounts (pre-GST, before bill discount)
  taxable: number | null; // pre-GST value after all discounts
  taxableFrom: "slip" | "computed" | null;
  makingPct: number | null; // (making + wastage) / metal
  total: number | null;
};

export function calcEstimate(e: Estimate): EstimateCalc {
  const items = e.items.map(calcItem);
  const s = (k: keyof ItemCalc) => sum(items.map((i) => i[k] as number | null));
  const bd = billDiscount(e);
  const itemsSum = s("lineAmount");
  const subtotal = known(e.subtotal);
  const taxable = subtotal !== null ? subtotal - bd : itemsSum !== null ? itemsSum - bd : null;
  const itemDiscounts = s("discount");
  const metal = s("goldValue");
  const making = s("making");
  const wastage = s("wastage");
  return {
    items,
    components: {
      metal, making, wastage,
      stones: s("stone"),
      other: s("other"),
      discount: itemDiscounts === null ? null : itemDiscounts + bd,
      gst: known(e.gstAmount),
    },
    itemsSum,
    taxable,
    taxableFrom: subtotal !== null ? "slip" : taxable !== null ? "computed" : null,
    makingPct: metal && making !== null && wastage !== null ? (making + wastage) / metal : null,
    total: known(e.total),
  };
}
