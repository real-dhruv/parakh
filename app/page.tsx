import Start, { type Note, type SampleCard } from "@/components/Start";
import { inr, review } from "@/lib/review";
import { SAMPLES } from "@/samples/data";

// What each synthetic sample exercises (matches its `expected` review points).
const FINDS: Record<string, string> = {
  "earrings-gift": "Gold and making charged on stone weight",
  "clean-chain": "A bill that passes every check",
  "diamond-ring": "Diamond weight in carats, not grams",
  "bangles-total": "Hinglish labels; the total is ₹600 off",
  "gst-on-making": "A separate 5% GST on making",
  "pendant-inclusive": "GST-inclusive price, purity not stated",
  "two-items-discount": "Two items, discount shown twice",
};

export default function Home() {
  const cards: SampleCard[] = SAMPLES.map(({ id, title, estimate }) => ({ id, title, estimate, finds: FINDS[id] ?? "" }));
  const [featured, ...rest] = cards;
  // The notes beside the featured slip come from the real engine, not hand-written copy.
  const notes: Note[] = review(featured.estimate).points
    .filter((p) => p.tier !== "tip")
    .map((p) => ({ title: p.title, tier: p.tier as Note["tier"], amount: p.atStake && p.atStake >= 1 ? inr(p.atStake) : undefined }));

  return (
    <main className="mx-auto max-w-[68rem] px-[var(--space-sm)] sm:px-[var(--space-lg)] pb-[var(--space-2xl)]">
      <header className="flex items-baseline justify-between py-[var(--space-md)]">
        <span className="font-display text-[length:var(--text-xl)] font-semibold tracking-tight">Parakh</span>
        <nav className="flex items-baseline gap-[var(--space-md)] text-[length:var(--text-sm)] text-ink-2">
          <a href="#how" className="nowrap py-2 hover:text-ink">How it works</a>
          <span className="nowrap">Prototype</span>
        </nav>
      </header>

      <div className="pt-[var(--space-lg)] md:pt-[var(--space-xl)]">
        <Start samples={rest} featured={featured} notes={notes} />
      </div>

      <footer className="mt-[var(--space-3xl)] border-t border-rule pt-[var(--space-sm)] text-[length:var(--text-xs)] leading-relaxed text-ink-2">
        Parakh · independent prototype by Dhruv Pawar · sample estimates are synthetic, shops fictional, gold rates illustrative ·
        helps you ask better questions; not financial, tax or legal advice
      </footer>
    </main>
  );
}
