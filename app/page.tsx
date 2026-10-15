import Start from "@/components/Start";
import { SAMPLES } from "@/samples/data";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <span className="font-display text-2xl font-semibold tracking-tight">Parakh</span>
        <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">Prototype</span>
      </header>

      <section className="pt-4 pb-7">
        <h1 className="font-display text-[34px] leading-[1.1] font-medium sm:text-[42px]">
          Got a jewellery estimate? <span className="text-gold">Get a second opinion</span> before you pay.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          Snap the slip from the counter. See what you&apos;re really paying for gold, making and stones, what doesn&apos;t add up, and
          exactly what to ask the jeweller.
        </p>
      </section>

      <Start samples={SAMPLES.map(({ id, title, estimate }) => ({ id, title, estimate }))} />

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">How it works</h2>
        <ol className="space-y-4">
          {[
            ["AI reads the slip", "A vision model transcribes every line — and keeps the exact text each number came from."],
            ["You confirm", "Nothing is judged until you've checked what was read. Unclear values are highlighted."],
            ["Code does the maths", "Every calculation is ordinary, tested code. The AI never produces a number in your report."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold text-sm font-semibold">{i + 1}</span>
              <div>
                <div className="font-medium">{t}</div>
                <div className="text-sm text-muted leading-relaxed">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-14 border-t border-line pt-5 text-[12px] leading-relaxed text-muted">
        Independent prototype by Dhruv Pawar. Sample estimates are synthetic, shops are fictional and gold rates shown are illustrative —
        not today&apos;s market rates. Parakh helps you ask better questions; it is not financial, tax or legal advice.
      </footer>
    </main>
  );
}
