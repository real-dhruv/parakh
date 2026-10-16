// Eval: which OpenRouter model reads slips best, and does Jev beat the alternatives on its two decisions?
// Run: npm run eval   (uses whichever of GROQ_API_KEY / OPENROUTER_API_KEY / TYPESAFE_API_KEY are in .env.local)
//      npm run eval -- --photos (also reads eval/photos/<sampleId>.jpg phone photos, if present)
import { mkdirSync, readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { chatJson, hasKey, readEstimate, toEstimate, keywordType } from "../lib/extract";
import { CHARGE_CRITERIA, classifyLabels, photoQuality } from "../lib/jev";
import { review } from "../lib/review";
import { BLURRED, SAMPLES, type Sample } from "../samples/data";
import { LABELS } from "./labels";
import type { Estimate } from "../lib/schema";

const MODELS = (process.env.EVAL_MODELS?.split(",") ?? [
  // free tier first
  `groq:${process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b"}`,
  "anthropic/claude-haiku-5.5",
  "openai/gpt-6-luna",
  "google/gemini-3.1-flash-lite",
  "qwen/qwen3.8-flash",
  // stronger tier: does paying more read slips better?
  "google/gemini-3.8-flash",
  "openai/gpt-5.4-mini",
]).filter(hasKey);
const BUDGET_USD = 2;
let spent = 0;
const guard = (c: number | null) => {
  spent += c ?? 0;
  if (spent > BUDGET_USD) throw new Error(`Budget guard: spent $${spent.toFixed(3)} > $${BUDGET_USD}`);
};
mkdirSync("eval/results/raw", { recursive: true });

// ---------- scoring helpers ----------
type Leaf = { path: string; value: unknown };
function leaves(e: Estimate): Leaf[] {
  const out: Leaf[] = [];
  const walk = (o: unknown, p: string) => {
    if (!o || typeof o !== "object") return;
    if ("value" in o && "confirmed" in o) {
      const v = (o as { value: unknown }).value;
      if (typeof v === "number" || v === null) out.push({ path: p, value: v });
      return;
    }
    for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
  };
  walk(e, "");
  return out.filter((l) => !l.path.endsWith(".rate") || l.value !== null);
}
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.001, Math.abs(b) * 0.005);
const confirmAll = (e: Estimate): Estimate => JSON.parse(JSON.stringify(e).replaceAll('"confirmed":false', '"confirmed":true'));

function score(truth: Estimate, pred: Estimate) {
  const t = leaves(truth);
  const p = new Map(leaves(pred).map((l) => [l.path, l.value]));
  let correct = 0, present = 0, nullOk = 0, nullTotal = 0, hallucinated = 0;
  for (const l of t) {
    const pv = p.get(l.path);
    if (l.value === null) {
      nullTotal++;
      if (pv === null || pv === undefined) nullOk++; else hallucinated++;
    } else {
      present++;
      if (typeof pv === "number" && close(pv, l.value as number)) correct++;
    }
  }
  return { correct, present, nullOk, nullTotal, hallucinated };
}

/** Groq's free tier allows ~8k tokens/min: on a 429, wait the suggested time (max 3 tries). */
async function withRateLimitWait<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      const m = String(e).match(/ 429:.*?try again in ([\d.]+)(m?s)/);
      if (!m || i >= 2) throw e;
      const ms = Math.ceil(parseFloat(m[1]) * (m[2] === "ms" ? 1 : 1000)) + 1000;
      console.log(`  rate limited, waiting ${Math.round(ms / 1000)} s`);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
}

// ---------- 1. extraction ----------
async function extraction() {
  const inputs: { s: Sample; file: string; kind: "rendered" | "photo" }[] = [...SAMPLES, BLURRED].map((s) => ({ s, file: `public/samples/${s.id}.png`, kind: "rendered" as const }));
  if (process.argv.includes("--photos") && existsSync("eval/photos")) {
    for (const f of readdirSync("eval/photos")) {
      const s = SAMPLES.find((x) => f.startsWith(x.id));
      if (s && /\.(jpe?g|png)$/i.test(f)) inputs.push({ s, file: `eval/photos/${f}`, kind: "photo" });
    }
  }
  type Row = { correct: number; present: number; nullOk: number; nullTotal: number; halluc: number; flagsExact: number; n: number; ms: number[]; cost: number; failures: number; quality: string[] };
  const rows: Record<string, Row> = {};
  for (const model of MODELS) {
    const r: Row = (rows[model] = { correct: 0, present: 0, nullOk: 0, nullTotal: 0, halluc: 0, flagsExact: 0, n: 0, ms: [], cost: 0, failures: 0, quality: [] });
    for (const { s, file, kind } of inputs) {
      const mime = file.endsWith(".png") ? "image/png" : "image/jpeg";
      const url = `data:${mime};base64,${readFileSync(file).toString("base64")}`;
      r.n++;
      try {
        const res = await withRateLimitWait(() => readEstimate({ imageDataUrl: url }, model));
        guard(res.costUsd);
        r.cost += res.costUsd ?? 0;
        r.ms.push(res.ms);
        r.quality.push(`${s.id}${kind === "photo" ? "(photo)" : ""}:${res.out.photoQuality}`);
        const pred = toEstimate(res.out);
        writeFileSync(`eval/results/raw/${model.replace("/", "_")}__${s.id}${kind === "photo" ? "__photo" : ""}.json`, JSON.stringify(res.out, null, 2));
        const sc = score(s.estimate, pred);
        r.correct += sc.correct; r.present += sc.present; r.nullOk += sc.nullOk; r.nullTotal += sc.nullTotal; r.halluc += sc.hallucinated;
        const got = [...new Set(review(confirmAll(pred)).points.map((p) => p.id))].sort().join(",");
        if (got === [...s.expected].sort().join(",")) r.flagsExact++;
        console.log(`${model} ${s.id} ${kind}: fields ${sc.correct}/${sc.present}, halluc ${sc.hallucinated}, points [${got}] vs [${s.expected.join(",")}] ${res.ms}ms`);
      } catch (e) {
        if (String(e).includes("Budget guard")) throw e;
        r.failures++;
        console.log(`${model} ${s.id}: FAILED ${String(e).slice(0, 160)}`);
      }
    }
  }
  return { rows, n: inputs.length };
}

// ---------- 2. label classification: keyword code vs Jev vs best LLM ----------
async function labelsEval(llmModel: string) {
  const truth = LABELS.map(([, t]) => t);
  const kw = LABELS.map(([l]) => keywordType(l) ?? "other");

  let t0 = Date.now();
  const jevOn = !!process.env.TYPESAFE_API_KEY;
  const jev = jevOn ? await classifyLabels(LABELS.map(([l]) => l)) : LABELS.map(() => ({ type: "other" as const, confidence: 0 }));
  const jevMs = Date.now() - t0;

  t0 = Date.now();
  const { json, costUsd } = await chatJson(llmModel,
    `Classify each line from an Indian jewellery shop estimate into one type.\nTypes:\n${Object.entries(CHARGE_CRITERIA).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\nLines:\n${LABELS.map(([l], i) => `${i}. ${l}`).join("\n")}\nReturn JSON {"types": [type for each line, in order]}.`);
  guard(costUsd);
  const llmMs = Date.now() - t0;
  const llm: string[] = (json as { types: string[] }).types;

  const acc = (xs: string[]) => xs.filter((x, i) => x === truth[i]).length;
  const lowConf = jev.filter((j) => j.confidence < 0.6).length;
  const jevWrongConf = jev.filter((j, i) => j.type !== truth[i]).map((j) => j.confidence);
  return {
    n: LABELS.length,
    jevOn,
    keyword: { acc: acc(kw), misses: LABELS.filter((_, i) => kw[i] !== truth[i]).map(([l]) => l) },
    jev: { acc: acc(jev.map((j) => j.type)), ms: jevMs, lowConf, wrongConf: jevWrongConf, misses: LABELS.filter((_, i) => jev[i].type !== truth[i]).map(([l]) => l) },
    llm: { model: llmModel, acc: acc(llm), ms: llmMs, cost: costUsd, misses: LABELS.filter((_, i) => llm[i] !== truth[i]).map(([l]) => l) },
  };
}

// ---------- 3. photo quality: Jev vs reader model's own judgement ----------
async function qualityEval(readerQuality: string[]) {
  const out: { id: string; expected: string; jev: string; jevConf: number; reader: string }[] = [];
  for (const s of [...SAMPLES, BLURRED]) {
    const b64 = readFileSync(`public/samples/${s.id}.png`).toString("base64");
    const q = await photoQuality(b64);
    const reader = readerQuality.find((x) => x.startsWith(`${s.id}:`))?.split(":")[1] ?? "?";
    out.push({ id: s.id, expected: s.style === "blur" ? "not clear" : "clear", jev: q.quality, jevConf: q.confidence, reader });
  }
  return out;
}

const pctS = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "—");
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);

async function main() {
  if (!MODELS.length) throw new Error("Set GROQ_API_KEY and/or OPENROUTER_API_KEY in .env.local");
  const ex = await extraction();
  const best = Object.entries(ex.rows).sort((a, b) => b[1].flagsExact - a[1].flagsExact || b[1].correct - a[1].correct || a[1].cost - b[1].cost)[0][0];
  const lab = await labelsEval(best);
  const qual = process.env.TYPESAFE_API_KEY ? await qualityEval(ex.rows[best].quality) : [];

  const md = `# Parakh — Eval results

Run: ${new Date().toISOString().slice(0, 16).replace("T", " ")} · total spend: $${spent.toFixed(4)} · inputs: ${ex.n} slip images (${SAMPLES.length} synthetic + 1 blurred${ex.n > SAMPLES.length + 1 ? ` + ${ex.n - SAMPLES.length - 1} phone photos` : ""}).
All inputs are synthetic. Small sample — treat as directional, not statistically significant.

## 1. Reading the slip (OpenRouter vision models)

| Model | Numeric fields exact | Missing left empty | Invented values | Review points exactly right | Median latency | Cost (all slips) | Failures |
|---|---|---|---|---|---|---|---|
${Object.entries(ex.rows).map(([m, r]) => `| ${m} | ${r.correct}/${r.present} (${pctS(r.correct, r.present)}) | ${r.nullOk}/${r.nullTotal} | ${r.halluc} | ${r.flagsExact}/${r.n} | ${(median(r.ms) / 1000).toFixed(1)} s | $${r.cost.toFixed(4)} | ${r.failures} |`).join("\n")}

**Chosen default:** \`${best}\` (most slips with exactly the right review points, then field accuracy, then cost).

## 2. Sorting charge labels (${lab.n} labels)

| Approach | Accuracy | Latency | Notes |
|---|---|---|---|
| Plain keyword rules (no AI) | ${lab.keyword.acc}/${lab.n} (${pctS(lab.keyword.acc, lab.n)}) | ~0 ms | misses: ${lab.keyword.misses.slice(0, 8).join(", ") || "none"} |
${lab.jevOn ? `| Jev (choice) | ${lab.jev.acc}/${lab.n} (${pctS(lab.jev.acc, lab.n)}) | ${lab.jev.ms} ms | ${lab.jev.lowConf} labels below 0.6 confidence; confidence on wrong answers: ${lab.jev.wrongConf.map((c) => c.toFixed(2)).join(", ") || "n/a"}; misses: ${lab.jev.misses.join(", ") || "none"} |` : "| Jev (choice) | not run (no TYPESAFE_API_KEY) | — | — |"}
| ${lab.llm.model} | ${lab.llm.acc}/${lab.n} (${pctS(lab.llm.acc, lab.n)}) | ${lab.llm.ms} ms | cost $${lab.llm.cost ?? "?"}; misses: ${lab.llm.misses.join(", ") || "none"} |

## 3. "Is this photo clear enough?"

| Slip | Expected | Jev (confidence) | Reader model |
|---|---|---|---|
${qual.map((q) => `| ${q.id} | ${q.expected} | ${q.jev} (${q.jevConf.toFixed(2)}) | ${q.reader} |`).join("\n")}

## Decision

_Filled in by hand after reading the numbers above._
`;
  writeFileSync("EVAL.md", md);
  writeFileSync("eval/results/summary.json", JSON.stringify({ ex: ex.rows, lab, qual, spent }, null, 2));
  console.log(md);
}

main().catch((e) => { console.error(e); process.exit(1); });
