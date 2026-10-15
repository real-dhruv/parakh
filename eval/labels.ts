// Charge labels as they appear on Indian jewellery estimates, with the expected type.
// Several deliberately differ from the examples given to Jev/the LLM, to avoid testing on hints.
import type { ChargeType } from "../lib/schema";

export const LABELS: [string, ChargeType][] = [
  ["MC", "making"], ["Making Chg", "making"], ["Mkg", "making"], ["Labour", "making"], ["Lbr Chg", "making"],
  ["Banai", "making"], ["Making @12%", "making"], ["M.C. per gm", "making"], ["Majuri", "making"], ["Karigari", "making"],
  ["Craftsmanship charges", "making"],
  ["VA", "wastage"], ["V.A. 8%", "wastage"], ["Wst 10%", "wastage"], ["Value Addition", "wastage"], ["Seedha wastage", "wastage"],
  ["Touch loss", "wastage"], ["Melting loss", "wastage"], ["Ghaat", "wastage"],
  ["Dia", "stone"], ["Diamond value", "stone"], ["Stone Chgs", "stone"], ["CZ", "stone"], ["Kundan work", "stone"],
  ["Polki", "stone"], ["Ruby", "stone"], ["Emerald 1.2ct", "stone"], ["Pearl", "stone"], ["Navratna stones", "stone"],
  ["HM charges", "hallmark"], ["BIS hallmarking", "hallmark"], ["HUID chg", "hallmark"], ["Hallmark fee", "hallmark"],
  ["Packing", "other"], ["Rhodium plating", "other"], ["Misc", "other"], ["Polishing", "other"], ["Gift box", "other"],
  ["Disc", "discount"], ["Less", "discount"], ["You saved", "discount"], ["MC Disc 20%", "discount"], ["Festive offer", "discount"],
  ["Round off (-)", "discount"],
];
