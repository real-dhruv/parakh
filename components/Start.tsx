"use client";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { save, setImage, toDataUrl, unconfirmed, type Meta } from "@/lib/store";
import type { Estimate } from "@/lib/schema";
import type { Sample } from "@/samples/data";

export type SampleCard = Pick<Sample, "id" | "title" | "estimate"> & { finds: string };
export type Note = { title: string; amount?: string; tier: "mismatch" | "ask" };

/** The whole interactive home page (Split Studio). Notes are computed server-side by the real rules. */
export default function Start({ samples, featured, notes }: { samples: SampleCard[]; featured: SampleCard; notes: Note[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  // Next keeps this page alive (hidden) after navigating to /check. Clear the transient
  // "reading" state when it's hidden, or coming back shows a frozen loading screen.
  useLayoutEffect(() => () => { setBusy(null); setPreview(null); setError(null); }, []);

  async function run(body: { imageDataUrl?: string; text?: string }, sample?: SampleCard) {
    setError(null);
    setBusy(sample ? sample.id : "upload");
    setPreview(sample ? `/samples/${sample.id}.png` : body.imageDataUrl ?? null);
    // A sample must never end in an error in front of a reviewer: if the AI can't answer
    // (not configured, rate-limited, out of credit, slow), show its answer key, clearly labelled.
    const sampleFallback = (reason: "off" | "busy") =>
      go(unconfirmed(sample!.estimate), { demo: reason, sampleId: sample!.id }, `/samples/${sample!.id}.png`);
    try {
      const res = await fetch("/api/extract", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(sample ? 25_000 : 45_000),
      }).catch((e) => {
        if (sample) return null;
        throw new Error(e?.name === "TimeoutError" ? "Reading took too long. Please try again, or paste the text." : "Couldn't reach Parakh. Check your connection and try again.");
      });
      if (!res) return sampleFallback("busy");
      const data = await res.json().catch(() => ({}));
      if (sample && !res.ok) return sampleFallback(res.status === 503 ? "off" : "busy");
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      go(data.estimate, { ...data.meta, sampleId: sample?.id }, body.imageDataUrl ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
      setPreview(null);
    }
  }

  function go(estimate: Estimate, meta: Meta, image: string | null) {
    setImage(image);
    save({ id: Date.now(), estimate, meta, step: "confirm" });
    router.push("/check");
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpe?g|heic|heif|webp)$/i.test(f.type)) return setError("Please choose a photo (JPG or PNG).");
    try { await run({ imageDataUrl: await toDataUrl(f) }); } catch { setError("Couldn't open that image. Try a JPG or PNG."); }
  }

  async function onSample(s: SampleCard) {
    const blob = await (await fetch(`/samples/${s.id}.png`)).blob();
    await run({ imageDataUrl: await toDataUrl(blob) }, s);
  }

  return (
    <>
      {busy && <Reading image={preview} />}

      {/* Split 1 — statement + actions | proof: a real slip with what Parakh found on it */}
      <section className="grid gap-[var(--space-xl)] md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-start">
        <div className="min-w-0 pt-[var(--space-xs)]">
          <h1 className="font-display font-medium text-[length:var(--text-display)] leading-[1.04] tracking-[-0.015em]">
            Check the jewellery bill <span className="text-accent-ink">before you pay.</span>
          </h1>
          <p className="mt-[var(--space-md)] max-w-[34rem] text-[length:var(--text-md)] leading-relaxed text-ink-2">
            Photograph the estimate from the counter. Parakh shows what you&apos;re really paying for gold, making and stones,
            which lines don&apos;t add up, and the exact question to ask the jeweller.
          </p>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="mt-[var(--space-lg)] flex flex-col gap-[var(--space-xs)] sm:flex-row">
            <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn btn-primary">Check my estimate</button>
            <button onClick={() => onSample(featured)} disabled={!!busy} className="btn btn-secondary">Try a sample</button>
          </div>
          <button onClick={() => setPasting((p) => !p)} disabled={!!busy} className="mt-[var(--space-xs)] py-2 text-[length:var(--text-sm)] text-ink-2 underline underline-offset-4">
            {pasting ? "Hide the text box" : "Or paste the estimate as text"}
          </button>
          {pasting && (
            <div className="mt-[var(--space-xs)] space-y-[var(--space-xs)]">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="Estimate text"
                placeholder={"Gross wt 6.400 g  Stone 0.600 g\nRate 9450/g  Gold 60,480\nMaking @950/g 6,080 …"}
                className="w-full rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 p-[var(--space-xs)] font-mono text-[length:var(--text-sm)]" />
              <button disabled={!!busy || !text.trim()} onClick={() => run({ text })} className="btn btn-secondary w-full">Check this text</button>
            </div>
          )}
          {error && <p role="alert" className="mt-[var(--space-sm)] border-t border-mismatch pt-[var(--space-xs)] text-[length:var(--text-sm)] text-mismatch">{error}</p>}
          <details className="mt-[var(--space-2xs)] max-w-[34rem]">
            <summary className="cursor-pointer py-2 text-[length:var(--text-sm)] text-ink-2">What happens to my photo?</summary>
          <p className="mt-[var(--space-2xs)] text-[length:var(--text-xs)] leading-relaxed text-ink-2">
            Your photo is sent through OpenRouter to a third-party AI model provider to be read; their data policies apply. Parakh&apos;s
            server keeps no copy. The extracted estimate (not the photo) stays in this tab&apos;s session storage until you close it; some
            browsers can restore it if you reopen a closed tab. Cover your name, phone and address before uploading.
          </p>
          </details>
        </div>

        <figure className="min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-[var(--space-sm)] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)]">
            <button onClick={() => onSample(featured)} disabled={!!busy} className="group block overflow-hidden rounded-[var(--radius-figure)] border border-rule bg-paper-2" aria-label="Check this sample estimate">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/samples/${featured.id}.png`} alt="A synthetic jeweller's estimate for jhumka earrings" className="w-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.01]" />
            </button>
            <figcaption className="min-w-0">
              <p className="font-display text-[length:var(--text-lg)]">What Parakh found on this slip</p>
              <ol className="ledger mt-[var(--space-2xs)]">
                {notes.map((n, i) => (
                  <li key={i} className="flex items-baseline gap-[var(--space-xs)] py-[var(--space-xs)]">
                    <span className={`mt-2 h-2 w-2 shrink-0 ${n.tier === "mismatch" ? "bg-mismatch" : "bg-ask"}`} aria-hidden />
                    <span className="flex-1 text-[length:var(--text-sm)] leading-snug">{n.title}</span>
                    {n.amount && <span className="font-display tnum text-[length:var(--text-base)] nowrap">{n.amount}</span>}
                  </li>
                ))}
              </ol>
              <p className="mt-[var(--space-2xs)] text-[length:var(--text-xs)] text-ink-2">Synthetic sample · fictional shop · illustrative gold rate</p>
            </figcaption>
          </div>
        </figure>
      </section>

      {/* Split 2 — how it works, proof on the opposite side */}
      <section id="how" className="mt-[var(--space-3xl)] grid gap-[var(--space-lg)] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 md:order-2">
          <h2 className="font-display font-medium text-[length:var(--text-2xl)] leading-tight">AI reads. You confirm. Rules decide.</h2>
          <p className="mt-[var(--space-sm)] max-w-[34rem] leading-relaxed text-ink-2">
            A vision model transcribes the slip and records the exact line each number came from. You check what it read. Then ordinary,
            tested rules do every calculation. The AI never writes a number in your report, and only arithmetic on the slip&apos;s own
            confirmed figures is ever called wrong. Everything else is a question to ask.
          </p>
        </div>
        <dl className="ledger min-w-0 border-y border-rule md:order-1">
          {[
            ["Read", "slip: “Gross Wt 6.400 g”", "6.4 g"],
            ["Confirm", "you tick each unclear value", "ticked"],
            ["Check", "₹60,480 ÷ ₹9,450/g", "6.4 g billed"],
            ["Ask", "“Which weight was the gold rate applied to?”", ""],
          ].map(([k, a, b]) => (
            <div key={k} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-baseline gap-[var(--space-xs)] py-[var(--space-xs)]">
              <dt className="font-display text-[length:var(--text-md)]">{k}</dt>
              <dd className="min-w-0 font-mono text-[length:var(--text-xs)] text-ink-2 break-words">{a}</dd>
              <dd className="font-display tnum nowrap">{b}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Split 3 — more samples */}
      <section className="mt-[var(--space-3xl)]">
        <h2 className="font-display font-medium text-[length:var(--text-2xl)] leading-tight">More sample estimates</h2>
        <p className="mt-[var(--space-2xs)] text-ink-2">All synthetic. Each one exercises a different check.</p>
        <ul className="ledger mt-[var(--space-md)] border-y border-rule">
          {samples.map((s) => (
            <li key={s.id}>
              <button onClick={() => onSample(s)} disabled={!!busy}
                className="group grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-[var(--space-sm)] py-[var(--space-xs)] text-left disabled:opacity-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/samples/${s.id}.png`} alt="" className="h-14 w-14 rounded-[var(--radius-input)] border border-rule object-cover object-top" />
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{s.title}</span>
                  <span className="block text-[length:var(--text-sm)] text-ink-2 leading-snug">{s.finds}</span>
                </span>
                <span className="text-accent-ink text-[length:var(--text-sm)] font-medium nowrap group-hover:underline">{busy === s.id ? "Reading…" : "Check →"}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Full-screen state while the AI reads the slip. */
function Reading({ image }: { image: string | null }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper px-[var(--space-md)]" role="status" aria-live="polite">
      {image && (
        <div className="relative w-52 max-h-72 overflow-hidden rounded-[var(--radius-figure)] border border-rule bg-paper-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="w-full" />
          <div className="scanline" />
        </div>
      )}
      <p className="mt-[var(--space-md)] font-display text-[length:var(--text-xl)]">Reading your estimate…</p>
      <p className="mt-[var(--space-2xs)] max-w-xs text-center leading-relaxed text-ink-2">
        Transcribing every line and noting where each number came from. Nothing is judged yet.
      </p>
      <p className="mt-[var(--space-xs)] text-[length:var(--text-sm)] text-ink-2 tnum">{secs} s</p>
    </div>
  );
}
