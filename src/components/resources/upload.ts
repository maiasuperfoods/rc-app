"use client";

/** Uploads straight to Supabase storage with a signed URL, so large files never pass through Vercel. */
export async function uploadToSignedUrl(signedUrl: string, file: File) {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const r = await fetch(signedUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const msg = (j as { message?: string; error?: string }).message ?? (j as { error?: string }).error ?? `Upload failed (${r.status})`;
    throw new Error(/maximum allowed size|too large|413/i.test(msg) || r.status === 413 ? `${file.name} is over the 50 MB storage limit on the current Supabase plan.` : msg);
  }
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
