import type { NextRequest } from "next/server";

/**
 * Stable, CDN-cached URLs for display images kept in private Supabase buckets
 * (course category art, vault screenshots). Storage hands out short-lived signed
 * links that change every time; serving them from a fixed path lets Vercel cache
 * the bytes and lets next/image resize them once instead of on every request.
 * Only the allow-listed paths below: display images, plus short example clips inside lessons (lesson-images/).
 */
function allowed(bucket: string, path: string) {
  if (path.includes("..")) return false;
  if (bucket === "kb-media") return /^(categories|lesson-images)\/[\w.-]+$/.test(path);
  if (bucket === "res-media") return /^presale\/[\w-]+\/[\w.-]+$/.test(path) || /^ppu\/[\w-]+\/\d+\/screenshot\/[\w.-]+$/.test(path);
  return false;
}

function signApi(bucket: string) {
  // course images are signed by the kb function, vault images by the resources function
  if (bucket === "kb-media" && process.env.KB_API_URL) return process.env.KB_API_URL;
  if (process.env.RESOURCES_API_URL) return process.env.RESOURCES_API_URL;
  return process.env.KB_API_URL?.replace(/\/kb$/, "/resources") ?? null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path: parts } = await ctx.params;
  const path = parts.map(decodeURIComponent).join("/");
  if (!allowed(bucket, path)) return new Response("Not found", { status: 404 });

  const api = signApi(bucket);
  const token = process.env.KB_API_TOKEN;
  if (!api || !token) return new Response("Media is not configured", { status: 503 });

  const signed = await fetch(`${api}?view=sign&bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, { headers: { "x-kb-token": token }, cache: "no-store" });
  if (!signed.ok) return new Response("Not found", { status: 404 });
  const { url } = (await signed.json()) as { url: string };

  // pass byte ranges through so short clips can play and seek (Safari requires it)
  const range = req.headers.get("range");
  const file = await fetch(url, { cache: "no-store", headers: range ? { range } : undefined });
  if (!file.ok || !file.body) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "content-type": file.headers.get("content-type") ?? "application/octet-stream",
    "accept-ranges": "bytes",
    // Browser: 1 day. Vercel CDN: 30 days (paths are content-addressed by id).
    "cache-control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = file.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(file.body, { status: file.status, headers });
}
