// SYNTHETIC demonstration estimates. Shops are fictional; the ₹9,450/g (22K) and ₹7,730/g (18K)
// rates are illustrative, not real market rates. Each slip is printed from the `source` strings
// below, so the rendered image and the answer key cannot drift apart.
import type { Charge, Estimate, Item } from "../lib/schema";

type F = { value: number | null; source: string | null; confirmed: boolean; unsure: boolean };
const f = (value: number, source: string): F => ({ value, source, confirmed: true, unsure: false });
const none = { value: null, source: null, confirmed: true, unsure: false };
const w = (value: number, unit: "g" | "ct", source: string) => ({ ...f(value, source), unit });
const noW = { ...none, unit: null };
const s = (value: string, source: string) => ({ value, source, confirmed: true, unsure: false });
const ch = (label: string, type: Charge["type"], basis: Charge["basis"], rate: number | null, amount: number, src: string): Charge => ({
  label, type, basis, rate: rate === null ? none : f(rate, src), amount: f(amount, src),
});

export type Style = "pos" | "thermal" | "handwritten" | "blur";
export type Sample = {
  id: string;
  title: string; // shown on the sample picker
  style: Style;
  header: string[];
  extraLines?: string[]; // printed after totals (e.g. CGST/SGST split)
  estimate: Estimate;
  expected: string[]; // review rule ids expected (sorted)
};

const item = (p: Partial<Item> & Pick<Item, "description" | "purity" | "grossWt" | "goldRate" | "goldValue" | "charges">): Item => ({
  stoneWt: noW, netWt: noW, hasStones: null, lineTotal: none, ...p,
});
const est = (p: Partial<Estimate> & Pick<Estimate, "shop" | "items" | "total">): Estimate => ({
  subtotal: none, discount: none, gstPct: none, gstAmount: none, taxMode: "exclusive", saleType: "retail_sale", huidMentioned: null, ...p,
});

export const SAMPLES: Sample[] = [
  {
    id: "earrings-gift",
    title: "₹75k earrings for Mom (stones)",
    style: "thermal",
    header: ["KESAR & SONS JEWELLERS", "Fictional shop · Synthetic sample", "ESTIMATE  No. 2207", "Date: 12-10-2026"],
    estimate: est({
      shop: s("Kesar & Sons Jewellers", "KESAR & SONS JEWELLERS"),
      items: [item({
        description: s("Jhumka earrings (pair)", "Jhumka Earrings (pair)"),
        purity: s("22K", "Purity: 22K916"),
        grossWt: w(6.4, "g", "Gross Wt      6.400 g"),
        stoneWt: w(0.6, "g", "Stone Wt      0.600 g"),
        netWt: w(5.8, "g", "Net Wt        5.800 g"),
        hasStones: true,
        goldRate: f(9450, "Gold Rate     9,450 /g"),
        goldValue: f(60480, "Gold Value    60,480"),
        charges: [
          ch("Making", "making", "per_g", 950, 6080, "Making @950/g  6,080"),
          ch("VA", "wastage", "pct", 8, 4838, "VA 8%          4,838"),
          ch("Stone charges", "stone", "flat", null, 1200, "Stone Chgs     1,200"),
        ],
        lineTotal: f(72598, "Item Total    72,598"),
      })],
      subtotal: f(72598, "Sub Total     72,598"),
      gstPct: f(3, "GST 3%         2,178"),
      gstAmount: f(2178, "GST 3%         2,178"),
      total: f(74776, "NET AMOUNT    74,776"),
      huidMentioned: false,
    }),
    expected: ["R3", "R4", "R7", "R9"],
  },
  {
    id: "clean-chain",
    title: "22K chain (clean bill)",
    style: "pos",
    header: ["AAROHI GOLD HOUSE", "Fictional shop · Synthetic sample", "Estimate #A-1043   15/10/2026"],
    extraLines: ["CGST 1.5%  1,984.50   SGST 1.5%  1,984.50"],
    estimate: est({
      shop: s("Aarohi Gold House", "AAROHI GOLD HOUSE"),
      items: [item({
        description: s("Rope chain", "Rope Chain 22K916"),
        purity: s("22K", "Rope Chain 22K916"),
        grossWt: w(12.5, "g", "Gross Wt (g)   12.500"),
        netWt: w(12.5, "g", "Net Wt (g)     12.500"),
        hasStones: false,
        goldRate: f(9450, "Rate/g         9,450.00"),
        goldValue: f(118125, "Gold Value     1,18,125.00"),
        charges: [ch("Making charges", "making", "pct", 12, 14175, "Making 12%     14,175.00")],
        lineTotal: f(132300, "Amount         1,32,300.00"),
      })],
      subtotal: f(132300, "Taxable Value  1,32,300.00"),
      gstPct: f(3, "GST @3%        3,969.00"),
      gstAmount: f(3969, "GST @3%        3,969.00"),
      total: f(136269, "Grand Total    1,36,269.00"),
      huidMentioned: true,
    }),
    expected: [],
  },
  {
    id: "diamond-ring",
    title: "18K diamond ring (carats)",
    style: "handwritten",
    header: ["Navratna Abhushan Kendra", "fictional shop — synthetic sample", "Estimate   14/10/26"],
    extraLines: ["HUID: K7P2Q9"],
    estimate: est({
      shop: s("Navratna Abhushan Kendra", "Navratna Abhushan Kendra"),
      items: [item({
        description: s("Solitaire-style diamond ring", "Diamond ring — 18K750"),
        purity: s("18K", "Diamond ring — 18K750"),
        grossWt: w(3.2, "g", "Gross wt  3.200 g"),
        stoneWt: w(0.35, "ct", "Dia  0.35 ct"),
        netWt: w(3.13, "g", "Net wt  3.130 g"),
        hasStones: true,
        goldRate: f(7730, "Rate 7730/g"),
        goldValue: f(24195, "Gold  24,195"),
        charges: [
          ch("Making", "making", "pct", 18, 4355, "MC 18%  4,355"),
          ch("Diamond", "stone", "flat", null, 21700, "Dia 0.35ct @ 62,000  21,700"),
        ],
        lineTotal: f(50250, "Total  50,250"),
      })],
      subtotal: f(50250, "Total  50,250"),
      gstPct: f(3, "GST 3%  1,508"),
      gstAmount: f(1508, "GST 3%  1,508"),
      total: f(51758, "Final  51,758"),
      huidMentioned: true,
    }),
    expected: [],
  },
  {
    id: "bangles-total",
    title: "Bangles, Hinglish slip (total off)",
    style: "handwritten",
    header: ["Chandan Jewellery Mart", "fictional shop — synthetic sample", "Kachcha estimate  11-10-26"],
    estimate: est({
      shop: s("Chandan Jewellery Mart", "Chandan Jewellery Mart"),
      items: [item({
        description: s("Bangles (pair)", "Kangan jodi 22ct (916)"),
        purity: s("22K", "Kangan jodi 22ct (916)"),
        grossWt: w(24, "g", "Wajan 24.000 gm"),
        hasStones: false,
        goldRate: f(9450, "Sona bhav 9450"),
        goldValue: f(226800, "Sona 2,26,800"),
        charges: [ch("Ghadai", "making", "per_g", 600, 14400, "Ghadai 600/gm  14,400")],
      })],
      subtotal: f(241200, "Jod  2,41,200"),
      gstPct: f(3, "GST 3%  7,236"),
      gstAmount: f(7236, "GST 3%  7,236"),
      total: f(249036, "Kul  2,49,036"),
      huidMentioned: false,
    }),
    expected: ["R1", "R9"],
  },
  {
    id: "gst-on-making",
    title: "Ring with 5% GST on making",
    style: "pos",
    header: ["MEHER FINE JEWELS", "Fictional shop · Synthetic sample", "Quotation Q-558   13/10/2026"],
    extraLines: ["GST 3% on gold 1,418 · GST 5% on making 236", "HUID: R4T8W2"],
    estimate: est({
      shop: s("Meher Fine Jewels", "MEHER FINE JEWELS"),
      items: [item({
        description: s("Plain band ring", "Plain Band Ring 22K916"),
        purity: s("22K", "Plain Band Ring 22K916"),
        grossWt: w(5, "g", "Gross/Net Wt   5.000 g"),
        netWt: w(5, "g", "Gross/Net Wt   5.000 g"),
        hasStones: false,
        goldRate: f(9450, "Rate           9,450/g"),
        goldValue: f(47250, "Metal Value    47,250"),
        charges: [ch("Making 10%", "making", "pct", 10, 4725, "Making 10%     4,725")],
        lineTotal: f(51975, "Value          51,975"),
      })],
      subtotal: f(51975, "Sub Total      51,975"),
      gstAmount: f(1654, "Total GST      1,654"),
      total: f(53629, "Payable        53,629"),
      huidMentioned: true,
    }),
    expected: ["R6"],
  },
  {
    id: "pendant-inclusive",
    title: "Pendant, GST-inclusive, no purity",
    style: "pos",
    header: ["TULSI ORNAMENTS", "Fictional shop · Synthetic sample", "Price slip   10/10/2026"],
    estimate: est({
      shop: s("Tulsi Ornaments", "TULSI ORNAMENTS"),
      items: [item({
        description: s("Gold pendant", "Gold Pendant"),
        purity: { value: "unknown", source: null, confirmed: true, unsure: false },
        grossWt: w(4, "g", "Weight         4.000 g"),
        hasStones: false,
        goldRate: f(9450, "Rate           9,450/g"),
        goldValue: f(37800, "Gold           37,800"),
        charges: [ch("Making", "making", "flat", null, 4200, "Making         4,200")],
        lineTotal: f(42000, "Price          42,000"),
      })],
      subtotal: f(42000, "Price          42,000"),
      gstAmount: f(1223, "Incl. GST 3%   1,223"),
      total: f(42000, "TOTAL (incl. GST) 42,000"),
      taxMode: "inclusive",
      huidMentioned: false,
    }),
    expected: ["R8", "R9"],
  },
  {
    id: "two-items-discount",
    title: "Two items + making discount",
    style: "thermal",
    header: ["TARA JEWELLERS", "Fictional shop · Synthetic sample", "ESTIMATE  No. 0391", "Date: 09-10-2026"],
    extraLines: ["HUID: M3N6B1, J8L4X5"],
    estimate: est({
      shop: s("Tara Jewellers", "TARA JEWELLERS"),
      items: [
        item({
          description: s("Ladies ring", "Ladies Ring 22K916"),
          purity: s("22K", "Ladies Ring 22K916"),
          grossWt: w(4.2, "g", "Wt            4.200 g"),
          hasStones: false,
          goldRate: f(9450, "Rate          9,450 /g"),
          goldValue: f(39690, "Gold          39,690"),
          charges: [
            ch("MC", "making", "pct", 11, 4366, "MC 11%         4,366"),
            ch("MC Disc 20%", "discount", "pct", 20, 873, "MC Disc 20%     -873"),
          ],
          lineTotal: f(43183, "Item Total    43,183"),
        }),
        item({
          description: s("Nose pin", "Nose Pin 22K916"),
          purity: s("22K", "Nose Pin 22K916"),
          grossWt: w(0.8, "g", "Gross Wt      0.800 g"),
          stoneWt: w(0.05, "g", "Stone Wt      0.050 g"),
          netWt: w(0.75, "g", "Net Wt        0.750 g"),
          hasStones: true,
          goldRate: f(9450, "Rate          9,450 /g"),
          goldValue: f(7088, "Gold           7,088"),
          charges: [
            ch("Making", "making", "flat", null, 1500, "Making         1,500"),
            ch("Stone", "stone", "flat", null, 400, "Stone            400"),
          ],
          lineTotal: f(8988, "Item Total     8,988"),
        }),
      ],
      subtotal: f(52171, "Sub Total     52,171"),
      discount: f(873, "You saved        873"),
      gstPct: f(3, "GST 3%         1,565"),
      gstAmount: f(1565, "GST 3%         1,565"),
      total: f(53736, "NET AMOUNT    53,736"),
      huidMentioned: true,
    }),
    expected: [],
  },
];

// Blurred photo of the first slip — eval only (tests whether the reader asks for confirmation).
export const BLURRED: Sample = { ...SAMPLES[0], id: "earrings-gift-blurred", title: "Blurred photo", style: "blur" };
