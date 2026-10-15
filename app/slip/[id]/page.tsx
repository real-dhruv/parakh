// Renders a SYNTHETIC estimate slip from sample data (used to produce the sample images).
import { notFound } from "next/navigation";
import { BLURRED, SAMPLES, type Sample } from "@/samples/data";

export const instant = false; // internal page used to render sample images; blocking is fine

export function generateStaticParams() {
  return [...SAMPLES, BLURRED].map((s) => ({ id: s.id }));
}

function lines(s: Sample): { text: string; strong?: boolean; rule?: boolean }[] {
  const e = s.estimate;
  const out: { text: string; strong?: boolean; rule?: boolean }[] = [];
  const add = (t: string | null | undefined, strong = false) => {
    const last = [...out].reverse().find((l) => !l.rule);
    if (t && last?.text !== t) out.push({ text: t, strong });
  };
  for (const it of e.items) {
    out.push({ text: "", rule: true });
    add(it.description.source, true);
    add(it.purity.source);
    [it.grossWt, it.stoneWt, it.netWt, it.goldRate, it.goldValue].forEach((x) => add(x.source));
    it.charges.forEach((c) => add(c.amount.source));
    add(it.lineTotal.source, true);
  }
  out.push({ text: "", rule: true });
  [e.subtotal, e.discount, e.gstPct, e.gstAmount].forEach((x) => add(x.source));
  s.extraLines?.forEach((t) => add(t));
  add(e.total.source, true);
  return out;
}

const STYLES: Record<Sample["style"], { paper: string; font: string; size: string; extra?: React.CSSProperties }> = {
  pos: { paper: "bg-white w-[400px] shadow", font: "font-mono", size: "text-[13px]" },
  thermal: { paper: "bg-[#f6f5ef] w-[330px] shadow", font: "font-mono uppercase", size: "text-[12px]" },
  handwritten: {
    paper: "w-[400px] shadow -rotate-1",
    font: "font-hand",
    size: "text-[24px] leading-[34px] text-[#1d2b6b]",
    extra: { backgroundColor: "#fffef4", backgroundImage: "repeating-linear-gradient(transparent 0 33px, #c9d6ee 33px 34px)" },
  },
  blur: { paper: "bg-[#f6f5ef] w-[330px] shadow", font: "font-mono uppercase", size: "text-[12px]", extra: { filter: "blur(1.4px)" } },
};

export default async function Slip({ params }: PageProps<"/slip/[id]">) {
  const { id } = await params;
  const s = [...SAMPLES, BLURRED].find((x) => x.id === id);
  if (!s) notFound();
  const st = STYLES[s.style];
  return (
    <main className="min-h-screen w-full bg-white flex justify-center items-start p-6">
      <div id="slip" className={`${st.paper} ${st.font} ${st.size} px-6 py-5 text-ink`} style={st.extra}>
        <div className="text-center mb-2">
          {s.header.map((h, i) => (
            <div key={i} className={i === 0 ? "font-bold tracking-wide" : "opacity-70"}>{h}</div>
          ))}
        </div>
        {lines(s).map((l, i) =>
          l.rule ? (
            <div key={i} className="border-t border-dashed border-current opacity-40 my-2" />
          ) : (
            <div key={i} className={`whitespace-pre ${l.strong ? "font-bold" : ""}`}>{l.text}</div>
          ),
        )}
        <div className="border-t border-dashed border-current opacity-40 my-2" />
        <div className="text-center opacity-70 text-[0.8em]">SYNTHETIC — for demonstration only</div>
      </div>
    </main>
  );
}
