"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Upload, Video, X } from "lucide-react";
import { kbUpdate, kbUploadUrl } from "@/app/(app)/knowledge-base/admin/actions";
import { MAX_UPLOAD_BYTES, uploadToSignedUrl } from "@/components/resources/upload";
import { isPlayableVideoLink } from "@/lib/video-embed";

/**
 * Admin-only controls under a lesson title: add a video when there is none,
 * or replace / remove the current one. Students never see this.
 */
export function VideoSlot({ lessonId, hasVideo }: { lessonId: string; hasVideo: boolean }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = pending || Boolean(status);

  const save = (patch: { video_path?: string | null; video_url?: string | null }) =>
    start(async () => {
      const r = await kbUpdate("lesson", lessonId, patch);
      setStatus(null);
      if (!r.ok) return setErr(r.error);
      setLinkOpen(false);
      setLink("");
      router.refresh();
    });

  const onFile = async (f: File) => {
    setErr(null);
    if (f.size > MAX_UPLOAD_BYTES) return setErr(`${f.name} is over 50 MB. Upload it to YouTube (unlisted), Vimeo or Loom and paste the link instead.`);
    setStatus(`Uploading ${f.name}…`);
    try {
      const u = await kbUploadUrl("video", f.name);
      if (!u.ok) throw new Error(u.error);
      await uploadToSignedUrl(u.data!.signedUrl, f);
      setStatus("Saving…");
      save({ video_path: u.data!.path });
    } catch (e) {
      setStatus(null);
      setErr(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const linkForm = (
    <form
      className="flex flex-wrap gap-2 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        const v = link.trim();
        if (!isPlayableVideoLink(v)) return setErr("Paste a YouTube, Vimeo, Loom or Google Drive link, or a direct link to an .mp4 file.");
        setErr(null);
        save({ video_path: null, video_url: v });
      }}
    >
      <input autoFocus className="input flex-1 min-w-60 !text-sm" placeholder="https://youtube.com/watch?v=…  ·  vimeo.com/…  ·  loom.com/share/…" value={link} onChange={(e) => setLink(e.target.value)} />
      <button className="btn btn-primary !py-1.5 !text-xs" disabled={busy}>Add</button>
      <button type="button" className="btn btn-ghost !py-1.5 !text-xs" onClick={() => { setLinkOpen(false); setErr(null); }}>Cancel</button>
    </form>
  );

  const input = <input ref={file} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />;
  const msg = (status || err) && <p className={`text-xs ${err ? "text-bad" : "text-gold"} flex items-center gap-1.5`}>{status && <Loader2 size={12} className="animate-spin" />}{err ?? status}</p>;

  if (hasVideo) {
    return (
      <div className="-mt-6 mb-8 flex flex-wrap items-center gap-2">
        {input}
        <span className="text-[11px] text-mute uppercase tracking-wider mr-1">Admin</span>
        <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={busy} onClick={() => file.current?.click()}><Upload size={12} /> Replace with a file</button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={busy} onClick={() => { setLinkOpen((o) => !o); setErr(null); }}><Link2 size={12} /> Replace with a link</button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs text-bad" disabled={busy} onClick={() => save({ video_path: null, video_url: null })}><X size={12} /> Remove video</button>
        {linkOpen && linkForm}
        {msg}
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-[var(--radius)] border border-dashed border-line-strong bg-panel/40 px-5 py-6 flex flex-col items-center text-center gap-3">
      {input}
      <div className="w-10 h-10 rounded-full bg-gold-dim text-gold grid place-items-center"><Video size={18} /></div>
      <div>
        <div className="text-sm text-ink font-medium">Add a video to this lesson</div>
        <p className="text-xs text-dim mt-0.5">It plays here, under the title. Only admins see this box; students see nothing until a video is added.</p>
      </div>
      {linkOpen ? linkForm : (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary !py-1.5 !text-xs" disabled={busy} onClick={() => file.current?.click()}><Upload size={13} /> Upload a file (up to 50 MB)</button>
          <button type="button" className="btn btn-secondary !py-1.5 !text-xs" disabled={busy} onClick={() => { setLinkOpen(true); setErr(null); }}><Link2 size={13} /> Paste a YouTube, Vimeo or Loom link</button>
        </div>
      )}
      {msg}
    </div>
  );
}
