"use client";
import { useMemo, useState } from "react";
import { inr, review, type ReviewPoint, type Tier } from "@/lib/review";
import { PURITIES, type Estimate, type Purity } from "@/lib/schema";
import { at, type Meta } from "@/lib/store";

const FIELD_NAMES: Record<string, string> = {
  grossWt: "Gross weight", stoneWt: "Stone weight", netWt: "Net weight", goldRate: "Gold rate", goldValue: "Gold value",
  lineTotal: "Item total", purity: "Purity", subtotal: "Subtotal", discount: "Bill discount", gstPct: "GST %", gstAmount: "GST amount", total: "Total",
};
type F = { value: number | string | null; source: string | null; unit?: string | null };

function describe(e: Estimate, path: string) {
  const f = at(e, path) as F | undefined;
  const parts = path.split(".");
  const last = parts[parts.length - 1];
  let name = FIELD_NAMES[last] ?? last;
  if (parts[2] === "charges") name = `${e.items[+parts[1]].charges[+parts[3]].label} ${last === "rate" ? "rate" : "amount"}`;
  if (parts[0] === "items" && e.items.length > 1) name = `${e.items[+parts[1]].description.value ?? `Item ${+parts[1] + 1}`} · ${name}`;
  const v = f?.value;
  const shown = v === null || v === undefined ? "—" : typeof v === "number" ? (f?.unit ? `${v} ${f.unit}` : v.toLocaleString("en-IN")) : v;
  return { name, shown, source: f?.source ?? null };
}

function Trace({ e, refs, formula }: { e: Estimate; refs: string[]; formula?: string }) {
  return (
    <div className="mt-3 rounded-lg bg-ivory border border-line p-3 text-[13px] space-y-1.5">
      {formula && <div className="font-mono text-[12px] text-ink">{formula}</div>}
      {refs.map((r) => {
        const d = describe(e, r);
        return (
          <div key={r} className="flex flex-wrap gap-x-2">
            <span className="text-muted">{d.name}:</span>
            <span className="tnum font-medium">{d.shown}</span>
            <span className="font-mono text-[12px] text-muted">{d.source ? `← slip: “${d.source}”` : "← entered by you"}</span>
          </div>
        );
      })}
    </div>
  );
}

const TIER: Record<Tier, { label: string; badge: string; card: string }> = {
  mismatch: { label: "Doesn't add up", badge: "bg-mismatch text-white", card: "border-mismatch/30 bg-mismatch-soft" },
  ask: { label: "Ask the jeweller", badge: "bg-ask text-white", card: "border-ask/25 bg-ask-soft" },
  tip: { label: "Good to know", badge: "bg-tip text-white", card: "border-tip/20 bg-tip-soft" },
};

function PointCard({ p, e }: { p: ReviewPoint; e: Estimate }) {
  const [open, setOpen] = useState(false);
  const t = TIER[p.tier];
  return (
    <article className={`rounded-xl border p-4 ${t.card}`}>
      <div className="flex items-start gap-3">
        <h3 className="flex-1 font-medium leading-snug">{p.title}</h3>
        {p.atStake !== undefined && Math.abs(p.atStake) >= 1 && (
          <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-0.5 text-[13px] font-semibold tnum">{inr(Math.abs(p.atStake))}</span>
        )}
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed">{p.detail}</p>
      {p.question && (
        <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-[14px]">
          <span className="text-muted">Ask: </span>“{p.question}”
        </p>
      )}
      {p.refs.length > 0 && (
        <button onClick={() => setOpen((o) => !o)} className="mt-2 text-[13px] text-muted underline underline-offset-4">
          {open ? "Hide source" : "Where do these numbers come from?"}
        </button>
      )}
      {open && <Trace e={e} refs={p.refs} />}
    </article>
  );
}

function Key({ label, value, sub, children }: { label: string; value: string; sub?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen((o) => !o)} className="text-left rounded-xl border border-line bg-card p-4 w-full">
      <div className="text-[12px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-display text-[26px] leading-tight tnum">{value}</div>
      {sub && <div className="mt-0.5 text-[13px] text-muted">{sub}</div>}
      <div className="mt-1 text-[12px] text-gold">{open ? "Hide calculation" : "Tap to see the calculation"}</div>
      {open && children}
    </button>
  );
}

const COLORS = { metal: "#a8741a", making: "#d9a441", wastage: "#e8c785", stones: "#5b6b8c", other: "#b6aea3", gst: "#3b3632" };
const NAMES = { metal: "Gold", making: "Making", wastage: "Wastage / VA", stones: "Stones", other: "Other", gst: "GST" };

export default function Report({ estimate: e, meta, onEdit }: { estimate: Estimate; meta: Meta; onEdit: () => void }) {
  const [boardRate, setBoardRate] = useState("");
  const [boardPurity, setBoardPurity] = useState<Purity>("22K");
  const [per10, setPer10] = useState(false);
  const [copied, setCopied] = useState(false);

  const board = useMemo(() => {
    const n = Number(boardRate.replace(/[,₹\s]/g, ""));
    return boardRate && n > 0 ? { ratePerG: per10 ? n / 10 : n, purity: boardPurity } : undefined;
  }, [boardRate, boardPurity, per10]);
  const r = useMemo(() => review(e, board), [e, board]);
  const c = r.calc;
  const counts = { mismatch: 0, ask: 0, tip: 0 } as Record<Tier, number>;
  r.points.forEach((p) => counts[p.tier]++);
  const stake = r.points.filter((p) => p.tier !== "tip").reduce((a, p) => a + Math.max(0, p.atStake ?? 0), 0);

  const total = c.total ?? 0;
  const segs = (Object.keys(COLORS) as (keyof typeof COLORS)[])
    .map((k) => ({ k, v: (k === "gst" ? c.components.gst : (c.components as Record<string, number | null>)[k]) ?? 0 }))
    .filter((s) => s.v > 0);
  const segSum = segs.reduce((a, s) => a + s.v, 0) || 1;

  async function share() {
    const lines = [
      `Parakh check — ${e.shop.value ?? "jewellery estimate"} (${inr(total)})`,
      ...r.points.filter((p) => p.tier !== "tip").map((p) => `• ${p.title}${p.question ? ` — ask: "${p.question}"` : ""}`),
      r.points.some((p) => p.tier !== "tip") ? "" : "• Nothing failed the checks.",
      "Checked with Parakh (prototype).",
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="space-y-6">
      {meta.demo && (
        <p className="rounded-lg border border-ask/30 bg-ask-soft p-3 text-[13px] text-ask">
          <b>Demo mode — AI not connected.</b> This sample&apos;s answer key was loaded instead of a live AI reading. All checks below are the real engine.
        </p>
      )}

      <section className="rounded-2xl bg-ink text-ivory p-5">
        <div className="text-[13px] opacity-70">{e.shop.value ?? "Your estimate"}</div>
        <div className="mt-1 font-display text-[38px] leading-none tnum">{c.total !== null ? inr(c.total) : "Total not read"}</div>
        {stake >= 1 && (
          <div className="mt-3 text-[15px]"><span className="font-semibold text-[#f3c77a] tnum">{inr(stake)}</span> worth asking about before you pay</div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
          {counts.mismatch > 0 && <span className="rounded-full bg-mismatch px-3 py-1">{counts.mismatch} doesn&apos;t add up</span>}
          {counts.ask > 0 && <span className="rounded-full bg-ask px-3 py-1">{counts.ask} to ask about</span>}
          {counts.mismatch + counts.ask === 0 && <span className="rounded-full bg-[#2f6b4f] px-3 py-1">Nothing failed our checks</span>}
          {counts.tip > 0 && <span className="rounded-full bg-white/15 px-3 py-1">{counts.tip} good to know</span>}
        </div>
        {!meta.demo && meta.model && (
          <div className="mt-4 text-[12px] opacity-60">
            Read by {meta.model}{meta.ms ? ` in ${(meta.ms / 1000).toFixed(1)} s` : ""}{meta.labelSource === "jev" ? " · charges sorted by Jev" : ""} · all maths by Parakh&apos;s rules
          </div>
        )}
      </section>

      {total > 0 && segs.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">What you&apos;re paying for</h2>
          <div className="flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label="Breakdown of the total">
            {segs.map((s) => <div key={s.k} style={{ width: `${(s.v / segSum) * 100}%`, background: COLORS[s.k] }} />)}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[14px]">
            {segs.map((s) => (
              <li key={s.k} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[s.k] }} />
                <span className="flex-1 text-muted">{NAMES[s.k]}</span>
                <span className="tnum">{inr(s.v)}</span>
              </li>
            ))}
            {(c.components.discount ?? 0) > 0 && (
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5" /><span className="flex-1 text-muted">Discount</span><span className="tnum">−{inr(c.components.discount!)}</span></li>
            )}
          </ul>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {e.items.map((it, i) => {
          const ic = c.items[i];
          if (ic.impliedRate === null) return null;
          const written = it.goldRate.value;
          const differs = written !== null && Math.abs(ic.impliedRate - written) / written > 0.005;
          return (
            <Key
              key={i}
              label={`Gold you pay for${e.items.length > 1 ? ` · ${it.description.value ?? `item ${i + 1}`}` : ""}`}
              value={`${inr(ic.impliedRate)}/g`}
              sub={differs ? `Slip says ${inr(written!)}/g — the difference comes from which weight was charged` : `per gram of net metal${it.purity.value && it.purity.value !== "unknown" ? `, ${it.purity.value}` : ""}`}
            >
              <Trace e={e} refs={[`items.${i}.goldValue`, `items.${i}.netWt`, ...(ic.netWtFrom === "slip" ? [] : [`items.${i}.grossWt`, `items.${i}.stoneWt`])]}
                formula={`${inr(ic.goldValue!)} ÷ ${+ic.netWtG!.toFixed(3)} g net = ${inr(ic.impliedRate)}/g`} />
            </Key>
          );
        })}
        {c.makingPct !== null && (
          <Key label="Making + wastage" value={`${+(c.makingPct * 100).toFixed(1)}%`} sub="of the gold value">
            <Trace e={e} refs={e.items.flatMap((it, i) => it.charges.map((ch, j) => (ch.type === "making" || ch.type === "wastage" ? `items.${i}.charges.${j}.amount` : "")).filter(Boolean))}
              formula={`(${inr(c.components.making!)} + ${inr(c.components.wastage!)}) ÷ ${inr(c.components.metal!)} gold`} />
          </Key>
        )}
        {c.components.metal !== null && total > 0 && (
          <Key label="Gold share of your bill" value={`${Math.round((c.components.metal / total) * 100)}%`} sub="the rest is making, stones, other charges and GST">
            <Trace e={e} refs={["total", ...e.items.map((_, i) => `items.${i}.goldValue`)]} formula={`${inr(c.components.metal)} gold ÷ ${inr(total)} total`} />
          </Key>
        )}
      </section>

      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="font-medium">Compare with the shop&apos;s board rate <span className="text-muted font-normal">(optional)</span></h2>
        <p className="mt-1 text-[13px] text-muted">Type the rate shown on the shop&apos;s display today. Parakh never assumes a gold rate.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input inputMode="decimal" value={boardRate} onChange={(ev) => setBoardRate(ev.target.value)} placeholder="₹ rate" aria-label="Board rate"
            className="w-32 rounded-md border border-line bg-white px-2 py-2 tnum" />
          <select value={per10 ? "10" : "1"} onChange={(ev) => setPer10(ev.target.value === "10")} className="rounded-md border border-line bg-white px-2 py-2">
            <option value="1">per gram</option><option value="10">per 10 g</option>
          </select>
          <select value={boardPurity} onChange={(ev) => setBoardPurity(ev.target.value as Purity)} className="rounded-md border border-line bg-white px-2 py-2">
            {PURITIES.filter((p) => p !== "unknown").map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </section>

      {(["mismatch", "ask", "tip"] as Tier[]).map((tier) =>
        counts[tier] ? (
          <section key={tier} className="space-y-3">
            <h2 className="flex items-center gap-2 font-medium"><span className={`rounded-full px-2.5 py-0.5 text-[12px] ${TIER[tier].badge}`}>{counts[tier]}</span>{TIER[tier].label}</h2>
            {r.points.filter((p) => p.tier === tier).map((p, i) => <PointCard key={i} p={p} e={e} />)}
          </section>
        ) : null,
      )}

      {r.taxModeAssumed && <p className="text-[13px] text-muted">GST treated as {r.taxModeUsed === "inclusive" ? "included in prices" : "added on top"} — the only reading under which the slip adds up.</p>}

      {r.cantCheck.length > 0 && (
        <section className="rounded-xl border border-dashed border-line p-4">
          <h2 className="font-medium">What Parakh couldn&apos;t check</h2>
          <ul className="mt-2 space-y-1.5 text-[14px]">
            {r.cantCheck.map((x, i) => <li key={i}><b className="font-medium">{x.what}:</b> <span className="text-muted">{x.why}</span></li>)}
          </ul>
        </section>
      )}

      <section className="rounded-xl bg-gold-soft p-4">
        <h2 className="font-medium">Before you pay</h2>
        <ul className="mt-2 space-y-1.5 text-[14px] list-disc pl-5">
          <li>Check each piece&apos;s HUID in the BIS Care app.</li>
          <li>Watch the final weighing; match gross / stone / net weight to the bill.</li>
          <li>Ask for the exchange and buyback terms in writing.</li>
          <li>Get an itemised final invoice, not just a total.</li>
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={share} className="rounded-xl bg-ink text-ivory py-3.5 font-medium">{copied ? "Copied ✓" : "Share with family"}</button>
        <button onClick={onEdit} className="rounded-xl border border-ink py-3.5 font-medium">Edit what we read</button>
      </div>
      <p className="text-[12px] text-muted leading-relaxed">
        Parakh checks the slip&apos;s own arithmetic and common billing patterns. A point to ask about is not proof of anything wrong — many have
        good answers. Not financial, tax or legal advice.
      </p>
    </div>
  );
}
