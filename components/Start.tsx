"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { save, setImage, toDataUrl, unconfirmed, type Meta } from "@/lib/store";
import type { Estimate } from "@/lib/schema";
import type { Sample } from "@/samples/data";

type SampleCard = Pick<Sample, "id" | "title" | "estimate">;

export default function Start({ samples }: { samples: SampleCard[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  async function run(body: { imageDataUrl?: string; text?: string }, sample?: SampleCard) {
    setError(null);
    setBusy(sample ? sample.id : "upload");
    setPreview(sample ? `/samples/${sample.id}.png` : body.imageDataUrl ?? null);
    try {
      const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.status === 503 && sample) {
        // No AI on this server: show the sample's answer key, clearly labelled as demo mode.
        return go(unconfirmed(sample.estimate), { demo: true, sampleId: sample.id }, `/samples/${sample.id}.png`);
      }
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
    save({ estimate, meta, step: "confirm" });
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
    <div className="space-y-8">
      {busy && <Reading image={preview} />}
      <section className="rounded-2xl bg-card border border-line p-5 shadow-sm">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="w-full rounded-xl bg-ink text-ivory py-4 text-[17px] font-medium active:scale-[0.99] transition disabled:opacity-60"
        >
          {busy === "upload" ? "Reading your estimate…" : "📷  Snap or upload your estimate"}
        </button>
        <button
          onClick={() => onSample(samples[0])}
          disabled={!!busy}
          className="mt-3 w-full rounded-xl border border-gold/50 bg-gold-soft py-3.5 text-[15px] font-medium text-gold-ink active:scale-[0.99] transition disabled:opacity-60"
        >
          No estimate handy? Try a sample (15 sec)
        </button>
        <button onClick={() => setPasting((p) => !p)} disabled={!!busy} className="mt-1 w-full py-2.5 text-sm text-muted underline underline-offset-4">
          {pasting ? "Hide" : "Or paste the estimate text"}
        </button>
        {pasting && (
          <div className="mt-3 space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"e.g.\nGross wt 6.400 g  Stone 0.600 g\nRate 9450/g  Gold 60,480\nMaking @950/g 6,080 …"}
              className="w-full rounded-xl border border-line bg-ivory p-3 font-mono text-sm"
            />
            <button disabled={!!busy || !text.trim()} onClick={() => run({ text })} className="w-full rounded-xl border border-ink py-3 font-medium disabled:opacity-40">
              {busy === "upload" ? "Reading…" : "Check this text"}
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg bg-mismatch-soft text-mismatch text-sm p-3">{error}</p>}
        <details className="mt-4 text-[13px] text-muted">
          <summary className="cursor-pointer py-1">🔒 What happens to my photo?</summary>
          <p className="mt-2 leading-relaxed">
            To read your estimate, your image is sent through OpenRouter to a third-party AI model provider; their data policies apply.
            Parakh&apos;s server doesn&apos;t save the image or the results. The extracted estimate (not the image) is kept in this tab&apos;s session
            storage so a refresh doesn&apos;t lose it; it&apos;s cleared when the tab is closed, though some browsers can restore it if you reopen a
            closed tab. Cover your name, phone and address before uploading.
          </p>
        </details>
      </section>

      <section>
        <h2 className="font-display text-[19px] mb-3">More sample estimates</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {samples.map((s) => (
            <button
              key={s.id}
              onClick={() => onSample(s)}
              disabled={!!busy}
              className="group text-left rounded-xl border border-line bg-card overflow-hidden hover:border-gold transition disabled:opacity-60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/samples/${s.id}.png`} alt="" className="h-28 w-full object-cover object-top" />
              <div className="p-2.5">
                <div className="text-[13px] font-medium leading-snug">{busy === s.id ? "Reading with AI…" : s.title}</div>
                <div className="mt-1 text-[12px] text-gold-ink">Synthetic sample</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Full-screen state while the AI reads the slip (typically 5–15 s). */
function Reading({ image }: { image: string | null }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ivory/97 backdrop-blur px-6" role="status" aria-live="polite">
      {image && (
        <div className="relative w-52 max-h-72 overflow-hidden rounded-lg border border-line bg-white shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="w-full" />
          <div className="scanline" />
        </div>
      )}
      <p className="mt-6 font-display text-[22px]">Reading your estimate…</p>
      <p className="mt-2 max-w-xs text-center text-[14px] leading-relaxed text-muted">
        AI is transcribing every line and noting where each number came from. Nothing is judged yet.
      </p>
      <p className="mt-3 text-[13px] text-muted tnum">{secs}s · usually 5–15 s</p>
    </div>
  );
}
