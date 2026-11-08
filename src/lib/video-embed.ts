/**
 * Turns a share link from a video host into its embeddable player URL.
 * Returns null for anything else (a direct video file, which plays in a <video> tag).
 */
export function videoEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const id = (s: string | undefined | null) => (s && /^[\w-]{6,}$/.test(s) ? s : null);
  if (host === "youtu.be") {
    const v = id(u.pathname.slice(1));
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const p = u.pathname.split("/").filter(Boolean);
    const v = id(u.searchParams.get("v")) ?? (["shorts", "embed", "live"].includes(p[0]) ? id(p[1]) : null);
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(\d{6,})(?:\/([\da-f]+))?/);
    return m ? `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}` : null;
  }
  if (host === "loom.com") {
    const m = u.pathname.match(/\/(?:share|embed)\/([\da-f]{16,})/);
    return m ? `https://www.loom.com/embed/${m[1]}` : null;
  }
  if (host === "drive.google.com") {
    const m = u.pathname.match(/\/file\/d\/([\w-]+)/) ?? (u.searchParams.get("id") ? [null, u.searchParams.get("id")] : null);
    return m?.[1] ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
  }
  return null;
}

/** True when the link is something the lesson player can show. */
export function isPlayableVideoLink(raw: string) {
  if (videoEmbedUrl(raw)) return true;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && /\.(mp4|webm|mov|m4v)$/i.test(u.pathname);
  } catch {
    return false;
  }
}
