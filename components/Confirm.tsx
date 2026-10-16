"use client";
import { useState } from "react";
import { CHARGE_TYPES, PURITIES, type Estimate } from "@/lib/schema";
import type { Meta } from "@/lib/store";

type F = { value: number | string | null; source: string | null; confirmed: boolean; unsure: boolean; unit?: string | null };
type Kind = "money" | "weight" | "purity" | "pct" | "rate";
const CHARGE_NAMES: Record<string, string> = { making: "Making", wastage: "Wastage / VA", stone: "Stones", hallmark: "Hallmark", other: "Other", discount: "Discount" };

function countUnsure(o: unknown): number {
  if (!o || typeof o !== "object") return 0;
  const self = "unsure" in o && (o as F).unsure && (o as F).value !== null ? 1 : 0;
  return self + Object.values(o).reduce<number>((a, v) => a + countUnsure(v), 0);
}

function show(f: F, kind: Kind): string {
  if (f.value === null) return "—";
  if (kind === "purity") return f.value === "unknown" ? "Written, unclear" : String(f.value);
  const n = Number(f.value);
  if (kind === "weight") return `${n.toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${f.unit ?? "?"}`;
  if (kind === "pct") return `${n}%`;
  if (kind === "rate") return `₹${n.toLocaleString("en-IN")}/g`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Receipt-style row: read-only by default, tap to edit. Unclear values ask for a tick. */
function Row({ label, f, set, kind = "money" }: { label: string; f: F; set: (fn: (f: F) => void) => void; kind?: Kind }) {
  const [editing, setEditing] = useState(false);
  const missing = f.value === null;
  const flagged = f.unsure && !missing;

  if (editing) {
    return (
      <div className="py-3 border-b border-rule last:border-0">
        <label className="text-[13px] text-ink-2">{label}</label>
        <div className="mt-2 flex items-center gap-2">
          {kind === "purity" ? (
            <select autoFocus value={(f.value as string) ?? ""} onChange={(ev) => set((x) => { x.value = ev.target.value || null; x.unsure = false; })}
              className="flex-1 rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 px-3 py-3 text-[16px]">
              <option value="">Not stated</option>
              {PURITIES.filter((p) => p !== "unknown").map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="unknown">Written, unclear</option>
            </select>
          ) : (
            <input autoFocus inputMode="decimal" aria-label={label} defaultValue={f.value ?? ""} placeholder="not on slip"
              onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
              onBlur={(ev) => {
                const raw = ev.target.value.replace(/[,₹\s%]/g, "").replace(/\/g$/i, "");
                const v = raw === "" ? null : Number(raw);
                if (raw === "" || !Number.isNaN(v)) set((x) => { x.value = v; x.unsure = false; });
              }}
              className="flex-1 min-w-0 rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 px-3 py-3 text-[16px] tnum" />
          )}
          {kind === "weight" && (
            <select value={f.unit ?? ""} aria-label="Unit" onChange={(ev) => set((x) => { x.unit = ev.target.value || null; })} className="rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 px-2 py-3 text-[16px]">
              <option value="">unit?</option><option value="g">g</option><option value="ct">ct</option><option value="mg">mg</option>
            </select>
          )}
          <button onClick={() => setEditing(false)} className="btn btn-primary !min-h-0 py-3">Done</button>
        </div>
        {f.source && <div className="mt-2 font-mono text-[12px] text-ink-2 break-words">slip: “{f.source}”</div>}
      </div>
    );
  }

  if (missing) {
    return (
      <button onClick={() => setEditing(true)} className="w-full flex items-center py-3 border-b border-rule last:border-0 text-left text-[14px] text-ink-2">
        <span className="flex-1">{label}</span>
        <span className="italic">not on slip</span>
        <span className="ml-3 text-accent-ink text-[13px] font-medium">Add</span>
      </button>
    );
  }

  return (
    <div className={`border-b border-rule last:border-0 ${flagged ? "bg-ask-soft -mx-[var(--space-sm)] px-[var(--space-sm)]" : ""}`}>
      <button onClick={() => setEditing(true)} className="w-full flex items-baseline gap-3 pt-3 pb-1 text-left" aria-label={`Edit ${label}`}>
        <span className="flex-1 text-[15px]">{label}</span>
        <span className="text-[16px] font-medium tnum">{show(f, kind)}</span>
      </button>
      <div className="flex items-center gap-2 pb-3 text-[12px]">
        <span className={`min-w-0 truncate ${f.source ? "font-mono text-ink-2" : "text-ink-2 italic"}`}>{f.source ? `slip: “${f.source}”` : "entered by you"}</span>
        {flagged && (
          <span className="ml-auto flex shrink-0 gap-2">
            <button onClick={() => setEditing(true)} className="rounded-[var(--radius-input)] border border-ask px-3 py-2 text-ask font-medium">Fix</button>
            <button onClick={() => set((x) => { x.unsure = false; })} className="rounded-[var(--radius-input)] bg-ask px-3 py-2 text-paper font-medium">Correct</button>
          </span>
        )}
      </div>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <label className="flex items-center gap-3 py-3 border-b border-rule last:border-0">
      <span className="flex-1 text-[15px]">{label}</span>
      <select value={value} onChange={(ev) => onChange(ev.target.value as T)} className="rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 px-3 py-2 text-[15px]">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default function Confirm({ initial, meta, image, onDone }: { initial: Estimate; meta: Meta; image: string | null; onDone: (e: Estimate) => void }) {
  const [e, setE] = useState(initial);
  const update = (fn: (d: Estimate) => void) => setE((prev) => { const d = structuredClone(prev); fn(d); return d; });
  const remaining = countUnsure(e);
  const fieldOf = (pick: (d: Estimate) => F) => ({ f: pick(e), set: (fn: (f: F) => void) => update((d) => fn(pick(d))) });

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-[var(--space-2xl)]">
    <div className="min-w-0 space-y-[var(--space-md)]">
      <div>
        <h1 className="font-display text-[length:var(--text-2xl)] leading-tight font-medium">Check what we read</h1>
        <p className="mt-2 text-[15px] text-ink-2 leading-relaxed">
          Each value shows the slip line it came from. Tap any value to fix it. Nothing is judged until you confirm.
        </p>
        {meta.demo && (
          <p className="mt-[var(--space-sm)] border-y border-ask py-[var(--space-xs)] text-ask text-[length:var(--text-sm)]">
            <b>Demo mode: AI not connected.</b> These values come from the sample&apos;s answer key, not a live AI reading.
          </p>
        )}
        {!meta.demo && meta.model && (
          <p className="mt-3 text-[13px] text-ink-2">
            Read by <span className="font-medium text-ink">{meta.model}</span>{meta.ms ? ` in ${(meta.ms / 1000).toFixed(1)} s` : ""}
            {meta.labelSource === "jev" ? " · charge types sorted by Jev" : ""}
          </p>
        )}
        {meta.unclear && <p className="mt-[var(--space-xs)] border-y border-ask py-[var(--space-xs)] text-ask text-[length:var(--text-sm)]">The photo looks partly unclear, so please check every highlighted value.</p>}
      </div>

      {image && (
        <details className="border-y border-rule lg:hidden" open={!!meta.unclear}>
          <summary className="cursor-pointer py-[var(--space-xs)] font-medium">View the slip</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="The estimate slip" className="w-full max-w-sm border border-rule mb-[var(--space-sm)]" />
        </details>
      )}

      {e.items.map((it, i) => (
        <section key={i} className="border-t border-rule-strong">
          <h2 className="pt-[var(--space-sm)] pb-[var(--space-3xs)] font-display text-[length:var(--text-lg)]">{it.description.value || `Item ${i + 1}`}</h2>
          <Row label="Purity" kind="purity" {...fieldOf((d) => d.items[i].purity as F)} />
          <Row label="Gross weight" kind="weight" {...fieldOf((d) => d.items[i].grossWt as F)} />
          <Row label="Stone weight" kind="weight" {...fieldOf((d) => d.items[i].stoneWt as F)} />
          <Row label="Net weight" kind="weight" {...fieldOf((d) => d.items[i].netWt as F)} />
          <Choice label="Has stones?" value={it.hasStones === null ? "" : String(it.hasStones)}
            options={[["", "Not sure"], ["true", "Yes"], ["false", "No"]]}
            onChange={(v) => update((d) => { d.items[i].hasStones = v === "" ? null : v === "true"; })} />
          <Row label="Gold rate" kind="rate" {...fieldOf((d) => d.items[i].goldRate as F)} />
          <Row label="Gold value" {...fieldOf((d) => d.items[i].goldValue as F)} />
          {it.charges.map((c, j) => (
            <div key={j} className="pt-1">
              <div className="flex items-center gap-2 pt-2 text-[13px]">
                <span className="text-ink-2">Charge</span>
                <button onClick={() => update((d) => { d.items[i].charges.splice(j, 1); })}
                  className="py-1 text-[length:var(--text-xs)] text-ink-2 underline underline-offset-4" aria-label={`Remove ${c.label}`}>Remove</button>
                <select value={c.type} aria-label={`Type of ${c.label}`}
                  onChange={(ev) => update((d) => { d.items[i].charges[j].type = ev.target.value as (typeof CHARGE_TYPES)[number]; })}
                  className="ml-auto rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 px-2 py-1 text-[13px] text-ink font-medium">
                  {CHARGE_TYPES.map((t) => <option key={t} value={t}>{CHARGE_NAMES[t]}</option>)}
                </select>
              </div>
              {c.basis === "pct" || c.basis === "per_g" ? (
                <Row label={`${c.label} rate`} kind={c.basis === "pct" ? "pct" : "rate"} {...fieldOf((d) => d.items[i].charges[j].rate as F)} />
              ) : null}
              <Row label={c.label} {...fieldOf((d) => d.items[i].charges[j].amount as F)} />
            </div>
          ))}
          <Row label="Item total" {...fieldOf((d) => d.items[i].lineTotal as F)} />
        </section>
      ))}

      <section className="border-t border-rule-strong">
        <h2 className="pt-[var(--space-sm)] pb-[var(--space-3xs)] font-display text-[length:var(--text-lg)]">Bill totals</h2>
        <Row label="Subtotal before GST" {...fieldOf((d) => d.subtotal as F)} />
        <Row label="Bill discount" {...fieldOf((d) => d.discount as F)} />
        <Row label="GST rate" kind="pct" {...fieldOf((d) => d.gstPct as F)} />
        <Row label="GST amount" {...fieldOf((d) => d.gstAmount as F)} />
        <Row label="Total" {...fieldOf((d) => d.total as F)} />
        <Choice label="Prices are" value={e.taxMode} options={[["exclusive", "before GST"], ["inclusive", "including GST"], ["unknown", "not sure"]]}
          onChange={(v) => update((d) => { d.taxMode = v; })} />
        <Choice label="This is" value={e.saleType} options={[["retail_sale", "a purchase"], ["job_work", "making from my gold"], ["unknown", "not sure"]]}
          onChange={(v) => update((d) => { d.saleType = v; })} />
      </section>

      <div className="sticky bottom-0 -mx-4 bg-paper/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-rule">
        <button disabled={remaining > 0} onClick={() => onDone(e)}
          className="btn btn-primary w-full">
          {remaining > 0 ? `Check ${remaining} highlighted value${remaining > 1 ? "s" : ""} first` : "Looks right. Check it"}
        </button>
      </div>
    </div>
    {image && (
      <aside className="hidden lg:block">
        <figure className="sticky top-[var(--space-md)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="The estimate slip" className="w-full max-w-md rounded-[var(--radius-figure)] border border-rule bg-paper-2" />
          <figcaption className="mt-[var(--space-2xs)] text-[length:var(--text-xs)] text-ink-2">The slip you&apos;re checking. Compare each value line by line.</figcaption>
        </figure>
      </aside>
    )}
    </div>
  );
}
