/** Stable app URL for a display image stored in a private bucket (see /api/media). */
export function mediaSrc(bucket: "kb-media" | "res-media", path: string | null | undefined) {
  if (!path) return null;
  return `/api/media/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
