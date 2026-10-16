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

/** Every figure traced back to the slip line it was read from. */
function Trace({ e, refs, formula }: { e: Estimate; refs: string[]; formula?: string }) {
  return (
    <div className="mt-[var(--space-xs)] border-l border-rule-strong pl-[var(--space-sm)] text-[length:var(--text-sm)]">
      {formula && <p className="font-mono text-[length:var(--text-xs)] text-ink">{formula}</p>}
      <dl className="mt-[var(--space-3xs)] space-y-[var(--space-3xs)]">
        {refs.map((r) => {
          const d = describe(e, r);
          if (d.shown === "—") return null; // not on the slip and not entered: nothing to trace
          return (
            <div key={r} className="flex flex-wrap gap-x-[var(--space-2xs)]">
              <dt className="text-ink-2">{d.name}</dt>
              <dd className="tnum font-medium">{d.shown}</dd>
              <dd className="font-mono text-[length:var(--text-xs)] text-ink-2 break-words">{d.source ? `slip: “${d.source}”` : "entered by you"}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

const TIER: Record<Tier, { word: string; mark: string; text: string }> = {
  mismatch: { word: "Doesn't add up", mark: "bg-mismatch", text: "text-mismatch" },
  ask: { word: "Ask the jeweller", mark: "bg-ask", text: "text-ask" },
  tip: { word: "Good to know", mark: "bg-tip", text: "text-tip" },
};

function Finding({ p, n, e }: { p: ReviewPoint; n: number; e: Estimate }) {
  const t = TIER[p.tier];
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-[var(--space-2xs)] py-[var(--space-md)]">
      <span className="font-display text-[length:var(--text-xl)] leading-none text-ink-2 tnum">{n}</span>
      <div className="min-w-0">
        <p className={`flex items-center gap-[var(--space-2xs)] text-[length:var(--text-xs)] font-semibold ${t.text}`}>
          <span className={`h-2 w-2 ${t.mark}`} aria-hidden />{t.word}
        </p>
        <div className="mt-[var(--space-3xs)] flex items-baseline gap-[var(--space-sm)]">
          <h3 className="flex-1 font-display text-[length:var(--text-lg)] leading-snug">{p.title}</h3>
          {p.atStake !== undefined && Math.abs(p.atStake) >= 1 && (
            <span className="font-display text-[length:var(--text-lg)] tnum nowrap">{inr(Math.abs(p.atStake))}</span>
          )}
        </div>
        <p className="mt-[var(--space-2xs)] leading-relaxed">{p.detail}</p>
        {p.question && (
          <p className="mt-[var(--space-xs)] leading-relaxed">
            <span className="text-ink-2">Ask: </span><em>“{p.question}”</em>
          </p>
        )}
        {p.refs.length > 0 && (
          <details className="mt-[var(--space-2xs)]">
            <summary className="cursor-pointer py-2 text-[length:var(--text-sm)] text-ink-2 underline underline-offset-4">Where these numbers come from</summary>
            <Trace e={e} refs={p.refs} />
          </details>
        )}
      </div>
    </li>
  );
}

const SEGS = [
  ["metal", "Gold", "bg-[var(--color-seg-metal)]"],
  ["making", "Making", "bg-[var(--color-seg-making)]"],
  ["wastage", "Wastage / VA", "bg-[var(--color-seg-wastage)]"],
  ["stones", "Stones", "bg-[var(--color-seg-stones)]"],
  ["other", "Other charges", "bg-[var(--color-seg-other)]"],
  ["gst", "GST", "bg-[var(--color-seg-gst)]"],
] as const;

const H2 = "font-display font-medium text-[length:var(--text-xl)] leading-tight";

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
  const main = r.points.filter((p) => p.tier !== "tip");
  const tips = r.points.filter((p) => p.tier === "tip");
  const stake = main.reduce((a, p) => a + Math.max(0, p.atStake ?? 0), 0);
  // The "hidden number": effective gold price vs the rate written on the slip (single-item bills).
  const hero = e.items.length === 1 && c.items[0].impliedRate !== null && e.items[0].goldRate.value
    && c.items[0].impliedRate / e.items[0].goldRate.value > 1.005 ? { implied: c.items[0].impliedRate, written: e.items[0].goldRate.value } : null;

  const total = c.total ?? 0;
  const segs = SEGS.map(([k, name, cls]) => ({ k, name, cls, v: (c.components as Record<string, number | null>)[k] ?? 0 })).filter((s) => s.v > 0);
  const segSum = segs.reduce((a, s) => a + s.v, 0) || 1;
  const shop = e.shop.value ?? "This jeweller";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const headline = stake >= 1
    ? <><span className="text-accent-ink tnum">{inr(stake)}</span> worth asking about before you pay.</>
    : counts.mismatch ? <>{plural(counts.mismatch, "line on this slip doesn't", "lines on this slip don't")} add up.</>
    : counts.ask ? <>{plural(counts.ask, "thing", "things")} to ask before you pay.</>
    : <>Nothing on this slip failed our checks.</>;

  async function share() {
    const text = [
      `Parakh check: ${shop} estimate, ${inr(total)}`,
      ...main.map((p) => `• ${p.title}${p.question ? `. Ask: "${p.question}"` : ""}`),
      main.length ? "" : "• Nothing failed the checks.",
      "Checked with Parakh (prototype).",
    ].filter(Boolean).join("\n");
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); }
    } catch { /* user cancelled */ }
  }

  return (
    <article className="max-w-[34rem]">
      {meta.demo && (
        <p className="mb-[var(--space-md)] border-y border-ask py-[var(--space-xs)] text-[length:var(--text-sm)] text-ask">
          <b>Demo mode: AI not connected.</b> This sample&apos;s answer key was loaded instead of a live AI reading. Every check below is the real engine.
        </p>
      )}

      <p className="text-[length:var(--text-sm)] text-ink-2">{shop} · estimate total <span className="tnum">{c.total !== null ? inr(c.total) : "not read"}</span></p>
      <h1 className="mt-[var(--space-2xs)] font-display font-medium text-[length:var(--text-2xl)] sm:text-[length:var(--text-display)] leading-[1.08] tracking-[-0.01em]">{headline}</h1>
      <p className="mt-[var(--space-sm)] text-[length:var(--text-md)] leading-relaxed">
        {hero && <>You effectively pay <b className="tnum">{inr(hero.implied)}</b> per gram of gold; the slip states <span className="tnum">{inr(hero.written)}</span>. </>}
        {/* Don't repeat what the headline already says. */}
        {counts.mismatch > 0 && stake >= 1 && <>{plural(counts.mismatch, "line doesn't", "lines don't")} add up on the slip&apos;s own figures. </>}
        {counts.mismatch > 0 && stake < 1 && <>Every other line reconciles; the finding below shows exactly where. </>}
        {counts.ask > 0 && (stake >= 1 || counts.mismatch > 0) && <>{plural(counts.ask, "point is", "points are")} worth asking the jeweller about; many have good answers. </>}
        {main.length === 0 && <>The slip&apos;s arithmetic reconciles and none of the billing patterns we check for appear.</>}
      </p>
      {!meta.demo && meta.model && (
        <p className="mt-[var(--space-xs)] text-[length:var(--text-xs)] text-ink-2">
          Read by {meta.model}{meta.ms ? ` in ${(meta.ms / 1000).toFixed(1)} s` : ""}{meta.labelSource === "jev" ? " · charges sorted by Jev" : ""} · every figure computed by Parakh&apos;s rules
        </p>
      )}

      {main.length > 0 && (
        <ol className="ledger mt-[var(--space-lg)] border-y border-rule">
          {main.map((p, i) => <Finding key={i} p={p} n={i + 1} e={e} />)}
        </ol>
      )}

      {total > 0 && segs.length > 0 && (
        <section className="mt-[var(--space-2xl)]">
          <h2 className={H2}>What you&apos;re paying for</h2>
          <div className="mt-[var(--space-sm)] flex h-2.5 w-full overflow-hidden" role="img" aria-label="Breakdown of the total">
            {segs.map((s) => <div key={s.k} className={s.cls} style={{ width: `${(s.v / segSum) * 100}%` }} />)}
          </div>
          <dl className="ledger mt-[var(--space-sm)]">
            {segs.map((s) => (
              <div key={s.k} className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto_3rem] items-baseline gap-[var(--space-2xs)] py-[var(--space-2xs)]">
                <span className={`h-2 w-2 ${s.cls}`} aria-hidden />
                <dt>{s.name}</dt>
                <dd className="tnum">{inr(s.v)}</dd>
                <dd className="tnum text-right text-[length:var(--text-sm)] text-ink-2">{Math.round((s.v / total) * 100)}%</dd>
              </div>
            ))}
            {(c.components.discount ?? 0) > 0 && (
              <div className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto_3rem] items-baseline gap-[var(--space-2xs)] py-[var(--space-2xs)]">
                <span /><dt>Discount</dt><dd className="tnum">−{inr(c.components.discount!)}</dd><span />
              </div>
            )}
            <div className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto_3rem] items-baseline gap-[var(--space-2xs)] border-t-[3px] border-double !border-rule-strong py-[var(--space-2xs)] font-semibold">
              <span /><dt>Total on slip</dt><dd className="tnum">{inr(total)}</dd><span />
            </div>
          </dl>
        </section>
      )}

      <section className="mt-[var(--space-2xl)]">
        <h2 className={H2}>The numbers behind it</h2>
        <div className="ledger mt-[var(--space-xs)] border-y border-rule">
          {e.items.map((it, i) => {
            const ic = c.items[i];
            if (ic.impliedRate === null) return null;
            return (
              <Measure key={i} label={`Gold price you effectively pay${e.items.length > 1 ? `, ${it.description.value ?? `item ${i + 1}`}` : ""}`} value={`${inr(ic.impliedRate)}/g`}>
                <Trace e={e} refs={[`items.${i}.goldValue`, `items.${i}.netWt`, ...(ic.netWtFrom === "slip" ? [] : [`items.${i}.grossWt`, `items.${i}.stoneWt`])]}
                  formula={`${inr(ic.goldValue!)} ÷ ${+ic.netWtG!.toFixed(3)} g net metal = ${inr(ic.impliedRate)}/g`} />
              </Measure>
            );
          })}
          {c.makingPct !== null && (
            <Measure label="Making and wastage, as a share of gold value" value={`${+(c.makingPct * 100).toFixed(1)}%`}>
              <Trace e={e} refs={e.items.flatMap((it, i) => it.charges.map((ch, j) => (ch.type === "making" || ch.type === "wastage" ? `items.${i}.charges.${j}.amount` : "")).filter(Boolean))}
                formula={`(${inr(c.components.making!)} + ${inr(c.components.wastage!)}) ÷ ${inr(c.components.metal!)} gold`} />
            </Measure>
          )}
          {c.components.metal !== null && total > 0 && (
            <Measure label="Gold as a share of the whole bill" value={`${Math.round((c.components.metal / total) * 100)}%`}>
              <Trace e={e} refs={["total", ...e.items.map((_, i) => `items.${i}.goldValue`)]} formula={`${inr(c.components.metal)} gold ÷ ${inr(total)} total`} />
            </Measure>
          )}
        </div>
        <p className="mt-[var(--space-md)] leading-relaxed">
          Know today&apos;s board rate in the shop? Enter it and Parakh compares it with the rate on the bill. It never assumes a gold rate.
        </p>
        <div className="mt-[var(--space-xs)] grid grid-cols-[minmax(0,1fr)_auto_auto] gap-[var(--space-2xs)] max-w-[26rem]">
          <input inputMode="decimal" value={boardRate} onChange={(ev) => setBoardRate(ev.target.value)} placeholder="₹ board rate" aria-label="Board rate"
            className="min-w-0 rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 px-[var(--space-xs)] py-[var(--space-2xs)] tnum" />
          <select value={per10 ? "10" : "1"} aria-label="Rate unit" onChange={(ev) => setPer10(ev.target.value === "10")} className="rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 px-[var(--space-2xs)] py-[var(--space-2xs)]">
            <option value="1">per gram</option><option value="10">per 10 g</option>
          </select>
          <select value={boardPurity} aria-label="Board rate purity" onChange={(ev) => setBoardPurity(ev.target.value as Purity)} className="rounded-[var(--radius-input)] border border-rule-strong bg-paper-2 px-[var(--space-2xs)] py-[var(--space-2xs)]">
            {PURITIES.filter((p) => p !== "unknown").map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </section>

      {tips.length > 0 && (
        <section className="mt-[var(--space-2xl)]">
          <h2 className={H2}>Good to know</h2>
          <ul className="ledger mt-[var(--space-xs)] border-y border-rule">
            {tips.map((p, i) => (
              <li key={i} className="py-[var(--space-sm)]">
                <p className="font-medium">{p.title}</p>
                <p className="mt-[var(--space-3xs)] leading-relaxed text-ink-2">{p.detail}{p.question && <> Ask: <em>“{p.question}”</em></>}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.taxModeAssumed && (
        <p className="mt-[var(--space-md)] text-[length:var(--text-sm)] text-ink-2">
          GST was treated as {r.taxModeUsed === "inclusive" ? "included in the prices" : "added on top"}: the only reading under which the slip adds up.
        </p>
      )}

      {r.cantCheck.length > 0 && (
        <section className="mt-[var(--space-2xl)]">
          <h2 className={H2}>What Parakh couldn&apos;t check</h2>
          <ul className="mt-[var(--space-xs)] space-y-[var(--space-2xs)] leading-relaxed">
            {r.cantCheck.map((x, i) => <li key={i}><span className="font-medium">{x.what}.</span> <span className="text-ink-2">{x.why}</span></li>)}
          </ul>
        </section>
      )}

      <section className="mt-[var(--space-2xl)] bg-accent-soft px-[var(--space-md)] py-[var(--space-md)]">
        <h2 className={H2}>Before you pay</h2>
        <ul className="mt-[var(--space-xs)] list-disc space-y-[var(--space-3xs)] pl-[var(--space-md)] leading-relaxed">
          <li>Check each piece&apos;s HUID in the BIS Care app.</li>
          <li>Watch the final weighing, and match gross, stone and net weight to the bill.</li>
          <li>Ask for the exchange and buyback terms in writing.</li>
          <li>Get an itemised final invoice, not just a total.</li>
        </ul>
      </section>

      <div className="mt-[var(--space-xl)] flex flex-col gap-[var(--space-xs)] sm:flex-row">
        <button onClick={share} className="btn btn-primary">{copied ? "Copied" : "Share with family"}</button>
        <button onClick={onEdit} className="btn btn-secondary">Edit what we read</button>
      </div>
      <p className="mt-[var(--space-md)] text-[length:var(--text-xs)] leading-relaxed text-ink-2">
        Parakh checks the slip&apos;s own arithmetic and common billing patterns. A point to ask about is not proof that anything is wrong.
        Not financial, tax or legal advice.
      </p>
    </article>
  );
}

function Measure({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <details className="group py-[var(--space-sm)]">
      <summary className="flex cursor-pointer list-none items-baseline gap-[var(--space-sm)]">
        <span className="flex-1">{label}<span className="ml-[var(--space-2xs)] text-[length:var(--text-sm)] text-accent-ink underline underline-offset-4 group-open:hidden">show</span></span>
        <span className="font-display text-[length:var(--text-xl)] tnum nowrap">{value}</span>
      </summary>
      {children}
    </details>
  );
}
