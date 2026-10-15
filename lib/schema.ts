import { z } from "zod";

export const PURITIES = ["24K999", "24K995", "23K", "22K", "20K", "18K", "14K", "9K", "unknown"] as const;
export const FINENESS: Record<Exclude<Purity, "unknown">, number> = {
  "24K999": 0.999, "24K995": 0.995, "23K": 0.958, "22K": 0.916,
  "20K": 0.833, "18K": 0.75, "14K": 0.585, "9K": 0.375,
};
export const CHARGE_TYPES = ["making", "wastage", "stone", "hallmark", "other", "discount"] as const;

// A value read from the slip. value null = unreadable/absent (never 0). source = raw slip text.
const field = <T extends z.ZodTypeAny>(t: T) =>
  z.object({
    value: t.nullable(),
    source: z.string().nullable(),
    confirmed: z.boolean(),
    unsure: z.boolean().default(false),
  });
const num = field(z.number());
const weight = num.extend({ unit: z.enum(["g", "ct", "mg"]).nullable() });

export const ChargeSchema = z.object({
  label: z.string(),
  type: z.enum(CHARGE_TYPES),
  basis: z.enum(["pct", "per_g", "flat"]).nullable(),
  rate: num,
  amount: num, // discounts stored positive, always subtracted
});

export const ItemSchema = z.object({
  description: field(z.string()),
  purity: field(z.enum(PURITIES)),
  grossWt: weight,
  stoneWt: weight,
  netWt: weight,
  hasStones: z.boolean().nullable(),
  goldRate: num, // ₹ per gram
  goldValue: num,
  charges: z.array(ChargeSchema),
  lineTotal: num, // pre-GST amount printed for the line, if any
});

export const EstimateSchema = z.object({
  shop: field(z.string()),
  items: z.array(ItemSchema),
  subtotal: num,
  discount: num, // bill-level discount, positive
  gstPct: num,
  gstAmount: num,
  total: num,
  taxMode: z.enum(["exclusive", "inclusive", "unknown"]),
  saleType: z.enum(["retail_sale", "job_work", "unknown"]),
  huidMentioned: z.boolean().nullable(),
});

export type Purity = (typeof PURITIES)[number];
export type ChargeType = (typeof CHARGE_TYPES)[number];
export type NumField = z.infer<typeof num>;
export type WeightField = z.infer<typeof weight>;
export type Charge = z.infer<typeof ChargeSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Estimate = z.infer<typeof EstimateSchema>;
