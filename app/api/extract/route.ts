import { cleanCharges, readChain, readEstimate, toEstimate, type ReadResult } from "@/lib/extract";
import { classifyLabels, jevEnabled } from "@/lib/jev";
import type { Estimate } from "@/lib/schema";

export const maxDuration = 60;

const MAX_DATAURL = 6_000_000; // ~4.5 MB image

// ponytail: per-instance, in-memory limiter — best-effort only. The real budget guard is the
// spend limit on the OpenRouter key. Swap for a shared store (e.g. Upstash) if traffic grows.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

const err = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  if (!readChain("text").length) return err(503, "AI is not connected on this server (demo mode).");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limited(ip)) return err(429, "Too many checks from this connection. Please try again in an hour.");

  let body: { imageDataUrl?: string; text?: string };
  try { body = await req.json(); } catch { return err(400, "Bad request."); }
  const { imageDataUrl, text } = body;
  if (!imageDataUrl && !text?.trim()) return err(400, "Send a photo or the estimate text.");
  if (imageDataUrl && (!/^data:image\/(png|jpeg);base64,/.test(imageDataUrl) || imageDataUrl.length > MAX_DATAURL))
    return err(400, "Please upload a PNG or JPEG under 4 MB.");
  if (text && text.length > 8000) return err(400, "That text is too long for one estimate.");

  try {
    // Photo clarity comes from the reader model only: in EVAL.md Jev added no signal over the reader on
    // this step, so it is kept for charge-label sorting (44/44) and not called twice.
    const read = await readFirstWorking({ imageDataUrl, text }, readChain(imageDataUrl ? "image" : "text"));
    const o = read.out;
    if (!o.isJewelleryEstimate || !o.items.length) return err(422, "This doesn't look like a jewellery estimate. Try a clearer photo or paste the text.");
    if (o.photoQuality === "unreadable")
      return err(422, "The photo is too unclear to read reliably. Retake it flat, in good light, or paste the text.");

    // Charge-label classification: Jev when available, otherwise the reader model's own guess.
    cleanCharges(o); // before Jev, so label positions stay aligned with toEstimate
    const labels = o.items.flatMap((it) => it.charges.map((c) => c.label));
    let labelSource: "jev" | "model" = "model";
    let types: Awaited<ReturnType<typeof classifyLabels>> | null = null;
    if (jevEnabled() && labels.length) {
      types = await classifyLabels(labels).catch(() => null);
      if (types) labelSource = "jev";
    }
    const estimate: Estimate = toEstimate(o, types?.map((t) => t.type));

    // If either judge thinks the photo is partly unclear, ask the user to check every value.
    const unclear = o.photoQuality === "partly_unclear";
    if (unclear) markAllUnsure(estimate);

    return Response.json({
      estimate,
      meta: {
        model: read.model, ms: read.ms, costUsd: read.costUsd, labelSource,
        quality: o.photoQuality,
        unclear,
      },
    });
  } catch (e) {
    console.error("extract failed:", e instanceof Error ? e.message : e);
    return err(502, "The AI reader is busy right now. Please try again in a minute, or try a sample.");
  }
}

function markAllUnsure(e: Estimate) {
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if ("unsure" in o && "value" in o && (o as { value: unknown }).value !== null) (o as { unsure: boolean }).unsure = true;
    Object.values(o).forEach(walk);
  };
  walk(e);
}

/** Try each model in order (Groq free tier first); fall back on rate limits or errors. */
async function readFirstWorking(input: { imageDataUrl?: string; text?: string }, chain: string[]): Promise<ReadResult> {
  let last: unknown;
  for (const ref of chain) {
    try { return await readEstimate(input, ref); } catch (e) {
      last = e;
      console.error(`read failed on ${ref}:`, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  throw last;
}
