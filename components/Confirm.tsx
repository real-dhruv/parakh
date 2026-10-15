"use client";
import { useState } from "react";
import { CHARGE_TYPES, PURITIES, type Estimate } from "@/lib/schema";
import type { Meta } from "@/lib/store";

type F = { value: number | string | null; source: string | null; confirmed: boolean; unsure: boolean; unit?: string | null };
const CHARGE_NAMES: Record<string, string> = { making: "Making", wastage: "Wastage / VA", stone: "Stones", hallmark: "Hallmark", other: "Other", discount: "Discount" };

function countUnsure(o: unknown): number {
  if (!o || typeof o !== "object") return 0;
  const self = "unsure" in o && (o as F).unsure && (o as F).value !== null ? 1 : 0;
  return self + Object.values(o).reduce<number>((a, v) => a + countUnsure(v), 0);
}

function Row({ label, f, set, kind = "num" }: { label: string; f: F; set: (fn: (f: F) => void) => void; kind?: "num" | "weight" | "purity" }) {
return (
  <div className={`py-2.5 border-b border-line last:border-0 ${f.unsure && f.value !== null ? "bg-ask-soft -mx-3 px-3 rounded-lg" : ""}`}>
    <div className="flex items-center gap-2">
      <label className="flex-1 text-[14px] text-muted">{label}</label>
      {kind === "purity" ? (
        <select
          value={(f.value as string) ?? ""}
          onChange={(ev) => set((x) => { x.value = ev.target.value || null; x.unsure = false; })}
          className="rounded-md border border-line bg-white px-2 py-1.5 text-[15px]"
        >
          <option value="">Not stated</option>
          {PURITIES.filter((p) => p !== "unknown").map((p) => <option key={p} value={p}>{p}</option>)}
          <option value="unknown">Written, unclear</option>
        </select>
      ) : (
        <input
          inputMode="decimal"
          aria-label={label}
          defaultValue={f.value ?? ""}
          placeholder="—"
          onBlur={(ev) => {
            const raw = ev.target.value.replace(/[,₹\s]/g, "");
            const v = raw === "" ? null : Number(raw);
            if (raw !== "" && Number.isNaN(v)) return;
            if (v !== f.value) set((x) => { x.value = v; x.unsure = false; });
          }}
          className="w-28 rounded-md border border-line bg-white px-2 py-1.5 text-right text-[15px] tnum"
        />
      )}
      {kind === "weight" && (
        <select value={f.unit ?? ""} onChange={(ev) => set((x) => { x.unit = ev.target.value || null; })} className="rounded-md border border-line bg-white px-1.5 py-1.5 text-[14px]">
          <option value="">unit?</option><option value="g">g</option><option value="ct">ct</option><option value="mg">mg</option>
        </select>
      )}
    </div>
    <div className="mt-1 flex items-center gap-2 text-[12px]">
      {f.source ? <span className="font-mono text-muted truncate">on slip: “{f.source}”</span> : <span className="text-muted/70 italic">{f.value === null ? "not on the slip" : "entered by you"}</span>}
      {f.unsure && f.value !== null && (
        <button onClick={() => set((x) => { x.unsure = false; })} className="ml-auto shrink-0 rounded-full bg-ask text-white px-2.5 py-0.5 font-medium">
          Check this · ✓ correct
        </button>
      )}
    </div>
  </div>
);
}

export default function Confirm({ initial, meta, image, onDone }: { initial: Estimate; meta: Meta; image: string | null; onDone: (e: Estimate) => void }) {
  const [e, setE] = useState(initial);
  const update = (fn: (d: Estimate) => void) => setE((prev) => { const d = structuredClone(prev); fn(d); return d; });
  const remaining = countUnsure(e);


  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium">Check what we read</h1>
        <p className="mt-1 text-[14px] text-muted leading-relaxed">
          Compare with your slip. Fix anything that&apos;s wrong — nothing is judged until you confirm.
          {meta.labelSource === "jev" && " Charge types were sorted by Jev."}
        </p>
        {meta.demo && (
          <p className="mt-2 rounded-lg border border-ask/30 bg-ask-soft text-ask text-[13px] p-2.5">
            <b>Demo mode — AI not connected.</b> These values are the sample&apos;s answer key, not a live AI reading.
          </p>
        )}
        {meta.unclear && <p className="mt-2 rounded-lg bg-ask-soft text-ask text-[13px] p-2.5">The photo looks partly unclear, so please check every number.</p>}
      </div>

      {image && (
        <details className="rounded-xl border border-line bg-card">
          <summary className="cursor-pointer p-3 text-[14px] font-medium">View your slip</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Your estimate" className="w-full rounded-b-xl" />
        </details>
      )}

      {e.items.map((it, i) => (
        <section key={i} className="rounded-xl border border-line bg-card px-3 py-1">
          <h2 className="pt-2.5 pb-1 font-medium">{it.description.value || `Item ${i + 1}`}</h2>
          <Row label="Purity" kind="purity" f={it.purity as F} set={(fn) => update((d) => fn(d.items[i].purity as F))} />
          <Row label="Gross weight" kind="weight" f={it.grossWt as F} set={(fn) => update((d) => fn(d.items[i].grossWt as F))} />
          <Row label="Stone weight" kind="weight" f={it.stoneWt as F} set={(fn) => update((d) => fn(d.items[i].stoneWt as F))} />
          <Row label="Net weight" kind="weight" f={it.netWt as F} set={(fn) => update((d) => fn(d.items[i].netWt as F))} />
          <div className="py-2.5 border-b border-line flex items-center gap-2">
            <label className="flex-1 text-[14px] text-muted">Has stones?</label>
            <select
              value={it.hasStones === null ? "" : String(it.hasStones)}
              onChange={(ev) => update((d) => { d.items[i].hasStones = ev.target.value === "" ? null : ev.target.value === "true"; })}
              className="rounded-md border border-line bg-white px-2 py-1.5 text-[15px]"
            >
              <option value="">Not sure</option><option value="true">Yes</option><option value="false">No</option>
            </select>
          </div>
          <Row label="Gold rate (₹/g)" f={it.goldRate as F} set={(fn) => update((d) => fn(d.items[i].goldRate as F))} />
          <Row label="Gold value (₹)" f={it.goldValue as F} set={(fn) => update((d) => fn(d.items[i].goldValue as F))} />
          {it.charges.map((c, j) => (
            <div key={j}>
              <div className="pt-2 flex items-center gap-2 text-[13px]">
                <span className="font-medium">{c.label}</span>
                <select
                  value={c.type}
                  onChange={(ev) => update((d) => { d.items[i].charges[j].type = ev.target.value as (typeof CHARGE_TYPES)[number]; })}
                  className="ml-auto rounded-full border border-line bg-gold-soft px-2 py-0.5 text-[12px] text-gold"
                  aria-label={`Type of ${c.label}`}
                >
                  {CHARGE_TYPES.map((t) => <option key={t} value={t}>{CHARGE_NAMES[t]}</option>)}
                </select>
              </div>
              {c.basis !== "flat" && c.basis !== null && (
                <Row label={c.basis === "pct" ? "Rate (%)" : "Rate (₹/g)"} f={c.rate as F} set={(fn) => update((d) => fn(d.items[i].charges[j].rate as F))} />
              )}
              <Row label="Amount (₹)" f={c.amount as F} set={(fn) => update((d) => fn(d.items[i].charges[j].amount as F))} />
            </div>
          ))}
          <Row label="Item total (₹)" f={it.lineTotal as F} set={(fn) => update((d) => fn(d.items[i].lineTotal as F))} />
        </section>
      ))}

      <section className="rounded-xl border border-line bg-card px-3 py-1">
        <h2 className="pt-2.5 pb-1 font-medium">Bill totals</h2>
        <Row label="Subtotal before GST (₹)" f={e.subtotal as F} set={(fn) => update((d) => fn(d.subtotal as F))} />
        <Row label="Bill discount (₹)" f={e.discount as F} set={(fn) => update((d) => fn(d.discount as F))} />
        <Row label="GST (%)" f={e.gstPct as F} set={(fn) => update((d) => fn(d.gstPct as F))} />
        <Row label="GST amount (₹)" f={e.gstAmount as F} set={(fn) => update((d) => fn(d.gstAmount as F))} />
        <Row label="Total (₹)" f={e.total as F} set={(fn) => update((d) => fn(d.total as F))} />
        <div className="py-2.5 border-b border-line flex items-center gap-2">
          <label className="flex-1 text-[14px] text-muted">Prices are</label>
          <select value={e.taxMode} onChange={(ev) => update((d) => { d.taxMode = ev.target.value as Estimate["taxMode"]; })} className="rounded-md border border-line bg-white px-2 py-1.5 text-[15px]">
            <option value="exclusive">before GST</option><option value="inclusive">including GST</option><option value="unknown">not sure</option>
          </select>
        </div>
        <div className="py-2.5 flex items-center gap-2">
          <label className="flex-1 text-[14px] text-muted">This is</label>
          <select value={e.saleType} onChange={(ev) => update((d) => { d.saleType = ev.target.value as Estimate["saleType"]; })} className="rounded-md border border-line bg-white px-2 py-1.5 text-[15px]">
            <option value="retail_sale">a purchase</option><option value="job_work">making from my own gold</option><option value="unknown">not sure</option>
          </select>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 bg-ivory/95 backdrop-blur px-4 py-3 border-t border-line">
        <button
          disabled={remaining > 0}
          onClick={() => onDone(e)}
          className="w-full rounded-xl bg-ink text-ivory py-4 text-[16px] font-medium disabled:opacity-40"
        >
          {remaining > 0 ? `Check ${remaining} highlighted value${remaining > 1 ? "s" : ""} first` : "Looks right — check my estimate →"}
        </button>
      </div>
    </div>
  );
}
