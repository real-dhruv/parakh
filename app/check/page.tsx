"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Confirm from "@/components/Confirm";
import Report from "@/components/Report";
import { confirmAll, getImage, load, save, type Session } from "@/lib/store";

export default function Check() {
  const [s, setS] = useState<Session | null | undefined>(undefined);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
  useEffect(() => setS(load()), []);
  const update = (next: Session) => { save(next); setS(next); window.scrollTo({ top: 0 }); };

  return (
    <main className="mx-auto max-w-[68rem] px-[var(--space-sm)] sm:px-[var(--space-lg)] pb-[var(--space-xl)]">
      <header className="flex items-baseline justify-between py-[var(--space-md)]">
        <Link href="/" className="font-display text-[length:var(--text-xl)] font-semibold tracking-tight">Parakh</Link>
        <Link href="/" className="nowrap py-2 text-[length:var(--text-sm)] text-ink-2 underline underline-offset-4">New check</Link>
      </header>
      {s === undefined ? null : s === null ? (
        <p className="py-10 text-center text-ink-2">No estimate yet. <Link href="/" className="underline">Start a check</Link>.</p>
      ) : s.step === "confirm" ? (
        <Confirm initial={s.estimate} meta={s.meta} image={getImage() ?? (s.meta.sampleId ? `/samples/${s.meta.sampleId}.png` : null)}
          onDone={(e) => update({ ...s, estimate: confirmAll(e), step: "report" })} />
      ) : (
        <Report estimate={s.estimate} meta={s.meta} onEdit={() => update({ ...s, step: "confirm" })} />
      )}
    </main>
  );
}
