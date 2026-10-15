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
    <main className="mx-auto max-w-xl px-4 pb-10">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight">Parakh</Link>
        <Link href="/" className="text-[13px] text-muted underline underline-offset-4">New check</Link>
      </header>
      {s === undefined ? null : s === null ? (
        <p className="py-10 text-center text-muted">No estimate yet. <Link href="/" className="underline">Start a check</Link>.</p>
      ) : s.step === "confirm" ? (
        <Confirm initial={s.estimate} meta={s.meta} image={getImage() ?? (s.meta.sampleId ? `/samples/${s.meta.sampleId}.png` : null)}
          onDone={(e) => update({ ...s, estimate: confirmAll(e), step: "report" })} />
      ) : (
        <Report estimate={s.estimate} meta={s.meta} onEdit={() => update({ ...s, step: "confirm" })} />
      )}
    </main>
  );
}
