import { describe, expect, it } from "vitest";
import { SAMPLES } from "../samples/data";
import { billDiscount, calcItem, toGrams } from "./calc";
import { review } from "./review";
import { EstimateSchema, type Estimate } from "./schema";

const clone = (e: Estimate): Estimate => structuredClone(e);
const ids = (e: Estimate, board?: Parameters<typeof review>[1]) => [...new Set(review(e, board).points.map((p) => p.id))].sort();
const byId = (id: string) => clone(SAMPLES.find((s) => s.id === id)!.estimate);

describe("samples", () => {
  for (const s of SAMPLES) {
    it(`${s.id} → ${s.expected.join(",") || "no points"}`, () => {
      expect(EstimateSchema.safeParse(s.estimate).success).toBe(true);
      expect(ids(s.estimate)).toEqual([...s.expected].sort());
    });
  }

  it("earrings: amounts at stake are the stone weight at gold/making rates", () => {
    const r = review(byId("earrings-gift"));
    expect(r.points.find((p) => p.id === "R3")!.atStake).toBeCloseTo(0.6 * 9450);
    expect(r.points.find((p) => p.id === "R4")!.atStake).toBeCloseTo(0.6 * 950);
  });

  it("bangles: total mismatch reports the ₹600 difference", () => {
    expect(review(byId("bangles-total")).points.find((p) => p.id === "R1")!.detail).toContain("₹600");
  });
});

describe("weights (carats, missing values)", () => {
  it("converts carats to grams", () => {
    expect(toGrams({ value: 0.35, unit: "ct", source: "x", confirmed: true, unsure: false })).toBeCloseTo(0.07);
  });
  it("unknown stone weight → net weight unknown, never gross", () => {
    const e = byId("earrings-gift");
    e.items[0].netWt = { value: null, source: null, confirmed: true, unsure: false, unit: null };
    e.items[0].stoneWt = { value: null, source: null, confirmed: true, unsure: false, unit: null };
    expect(calcItem(e.items[0]).netWtG).toBeNull();
    expect(review(e).cantCheck.some((c) => c.what.includes("net metal weight"))).toBe(true);
  });
  it("diamond ring in carats raises no stone-weight point", () => {
    expect(ids(byId("diamond-ring"))).toEqual([]);
  });
});

describe("S2: mismatches need confirmed slip values", () => {
  it("unconfirmed total → no 'doesn't add up', goes to can't-check path", () => {
    const e = byId("bangles-total");
    e.total.confirmed = false;
    expect(ids(e)).not.toContain("R1");
  });
  it("user-typed (no source) subtotal cannot prove a mismatch", () => {
    const e = byId("bangles-total");
    e.subtotal.source = null;
    expect(ids(e)).not.toContain("R1");
  });
});

describe("S1: discounts", () => {
  it("summary discount equal to item discount lines is counted once", () => {
    expect(billDiscount(byId("two-items-discount"))).toBe(0);
    expect(ids(byId("two-items-discount"))).toEqual([]);
  });
  it("a genuinely separate bill discount is subtracted", () => {
    const e = byId("clean-chain");
    e.discount = { value: 1000, source: "Festive discount 1,000", confirmed: true, unsure: false };
    e.gstAmount.value = (132300 - 1000) * 0.03;
    e.total.value = 131300 + (132300 - 1000) * 0.03;
    expect(billDiscount(e)).toBe(1000);
    expect(ids(e)).toEqual([]);
  });
});

describe("GST", () => {
  it("separate CGST/SGST 3% lines are not flagged", () => expect(ids(byId("clean-chain"))).toEqual([]));
  it("inclusive pricing reconciles at 3/103", () => expect(ids(byId("pendant-inclusive"))).not.toContain("R6"));
  it("unknown tax mode is inferred when only one reading adds up", () => {
    const e = byId("clean-chain");
    e.taxMode = "unknown";
    const r = review(e);
    expect(r.taxModeUsed).toBe("exclusive");
    expect(r.taxModeAssumed).toBe(true);
  });
  it("job work skips the 3% rule", () => {
    const e = byId("gst-on-making");
    e.saleType = "job_work";
    expect(ids(e)).not.toContain("R6");
    expect(review(e).cantCheck.some((c) => c.what === "GST rate")).toBe(true);
  });
  it("GST rate other than 3% is asked about", () => {
    const e = byId("clean-chain");
    e.gstPct.value = 5;
    expect(ids(e)).toContain("R6");
  });
});

describe("board rate", () => {
  it("flags a rate above the same-purity board rate", () => {
    expect(ids(byId("clean-chain"), { ratePerG: 9300, purity: "22K" })).toContain("R5");
  });
  it("never compares across purities", () => {
    const r = review(byId("diamond-ring"), { ratePerG: 9300, purity: "22K" });
    expect(r.points.map((p) => p.id)).not.toContain("R5");
    expect(r.cantCheck.some((c) => c.what.includes("board rate"))).toBe(true);
  });
});

describe("wording", () => {
  it("no review point accuses the jeweller", () => {
    for (const s of SAMPLES) for (const p of review(s.estimate).points) {
      expect(`${p.title} ${p.detail}`).not.toMatch(/overcharg|cheat|fraud|scam|illegal/i);
    }
  });
});

describe("answer keys, checked without the engine", () => {
  for (const s of SAMPLES) {
    const e = s.estimate;
    it(`${s.id}: slip totals ${s.expected.includes("R1") ? "do NOT" : "do"} reconcile`, () => {
      const lines = e.items.map((it) => it.lineTotal.value ?? it.charges.reduce((a, c) => a + (c.type === "discount" ? -1 : 1) * c.amount.value!, it.goldValue.value!));
      const sub = lines.reduce((a, x) => a + x, 0);
      const expectedTotal = e.taxMode === "inclusive" ? sub : sub + e.gstAmount.value!;
      const ok = Math.abs(sub - e.subtotal.value!) <= 2 && Math.abs(expectedTotal - e.total.value!) <= 2;
      expect(ok).toBe(!s.expected.includes("R1"));
    });
  }
});
