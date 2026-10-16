"use client";
import type { Estimate } from "./schema";

export type Meta = {
  demo?: "off" | "busy"; // sample answer key shown instead of a live read: AI not configured, or unavailable right now
  sampleId?: string;
  model?: string;
  ms?: number;
  costUsd?: number | null;
  labelSource?: "jev" | "model";
  unclear?: boolean;
};
export type Session = { id: number; estimate: Estimate; meta: Meta; step: "confirm" | "report" };

const KEY = "parakh:session";
// The uploaded image stays in memory only (lost on refresh by design; see privacy note).
let imageInMemory: string | null = null;
export const setImage = (url: string | null) => (imageInMemory = url);
export const getImage = () => imageInMemory;

export function save(s: Session) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: app still works in-memory */ }
}
export function load(): Session | null {
  try { const v = sessionStorage.getItem(KEY); return v ? (JSON.parse(v) as Session) : null; } catch { return null; }
}

/** Resolve a field path like "items.0.charges.1.amount" against an estimate. */
export function at(e: Estimate, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), e);
}

/** Return a deep copy with every field marked as confirmed by the user. */
export function confirmAll(e: Estimate): Estimate {
  const c = structuredClone(e);
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if ("confirmed" in o && "value" in o) Object.assign(o, { confirmed: true, unsure: false });
    Object.values(o).forEach(walk);
  };
  walk(c);
  return c;
}

/** Sample answer key presented as if freshly read: nothing confirmed yet. */
export function unconfirmed(e: Estimate): Estimate {
  const c = structuredClone(e);
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if ("confirmed" in o && "value" in o) (o as { confirmed: boolean }).confirmed = false;
    Object.values(o).forEach(walk);
  };
  walk(c);
  return c;
}

/** Downscale a photo to ≤1600px JPEG before upload (smaller, faster, cheaper). */
export async function toDataUrl(file: Blob, max = 1600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}
