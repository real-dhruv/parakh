"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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

  async function run(body: { imageDataUrl?: string; text?: string }, sample?: SampleCard) {
    setError(null);
    setBusy(sample ? sample.id : "upload");
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
      <section className="rounded-2xl bg-card border border-line p-5 shadow-sm">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="w-full rounded-xl bg-ink text-ivory py-4 text-[17px] font-medium active:scale-[0.99] transition disabled:opacity-60"
        >
          {busy === "upload" ? "Reading your estimate…" : "📷  Snap or upload your estimate"}
        </button>
        <button onClick={() => setPasting((p) => !p)} disabled={!!busy} className="mt-3 w-full text-sm text-muted underline underline-offset-4">
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
          <summary className="cursor-pointer">🔒 What happens to my photo?</summary>
          <p className="mt-2 leading-relaxed">
            To read your estimate, your image is sent through OpenRouter to a third-party AI model provider; their data policies apply.
            Parakh&apos;s server doesn&apos;t save the image or the results. The extracted estimate (not the image) is kept in this tab&apos;s session
            storage so a refresh doesn&apos;t lose it; it&apos;s cleared when the tab is closed, though some browsers can restore it if you reopen a
            closed tab. Cover your name, phone and address before uploading.
          </p>
        </details>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">No estimate handy? Try a sample</h2>
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
                <div className="mt-1 text-[11px] text-gold">Synthetic sample</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
