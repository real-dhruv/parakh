import { choice, Image, TypeSafeClient } from "@typesafe-ai/sdk";
import type { ChargeType } from "./schema";

export const CHARGE_CRITERIA = {
  making: "Labour / making charge for crafting the piece (e.g. MC, Making, Labour, Ghadai, Mazdoori)",
  wastage: "Wastage or value-addition charge for metal lost in making (e.g. Wastage, Wst, VA, Value Addition, Ghaat)",
  stone: "Price of stones, diamonds, gems, kundan or polki set in the piece",
  hallmark: "Hallmarking / HUID / certification fee",
  other: "Any other charge (packing, polishing, certificate, misc.)",
  discount: "A discount, saving or amount subtracted",
} satisfies Record<ChargeType, string>;

const QUALITY_CRITERIA = {
  clear: "Every number on the estimate can be read with certainty",
  partly_unclear: "Some numbers are blurred, cut off, overwritten or ambiguous",
  unreadable: "Most of the estimate can't be read reliably, or it isn't an estimate",
};

let client: TypeSafeClient | null = null;
const getClient = () =>
  (client ??= new TypeSafeClient({ timeout: 15_000, defaultHeaders: { "TypeSafe-Danger-Zone-Images": "true" } }));

export const jevEnabled = () => !!process.env.TYPESAFE_API_KEY;

export type LabelDecision = { type: ChargeType; confidence: number };

/** One request classifies all charge labels on a slip. */
export async function classifyLabels(labels: string[]): Promise<LabelDecision[]> {
  if (!labels.length) return [];
  const questions = Object.fromEntries(
    labels.map((l, i) => [`l${i}`, choice(`On an Indian jewellery shop estimate, what kind of line is "${l}"?`, CHARGE_CRITERIA)]),
  );
  const res = await getClient().systemOne({ state: { lines: labels }, questions });
  return labels.map((_, i) => {
    const a = res.answers[`l${i}`] as { choice: ChargeType; confidence: number };
    return { type: a.choice, confidence: a.confidence };
  });
}

export type QualityDecision = { quality: keyof typeof QUALITY_CRITERIA; confidence: number };

export async function photoQuality(imageBase64: string): Promise<QualityDecision> {
  const res = await getClient().systemOne({
    state: Image.fromBase64(imageBase64),
    questions: { quality: choice("How readable is this jewellery estimate photo?", QUALITY_CRITERIA) },
  });
  return { quality: res.answers.quality.choice as QualityDecision["quality"], confidence: res.answers.quality.confidence };
}
