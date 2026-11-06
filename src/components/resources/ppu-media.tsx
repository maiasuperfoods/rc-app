"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { mediaSrc } from "@/lib/media";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Trash2, Upload, Video } from "lucide-react";
import { ppuDeleteMedia, ppuRegisterMedia, ppuUploadUrl } from "@/app/(app)/resources/actions";
import { MAX_UPLOAD_BYTES, uploadToSignedUrl } from "./upload";
import { Lightbox } from "./screenshots";

type Media = { id: string; url: string | null; path?: string | null };

function AdminUpload({ brandId, step, kind, onError }: { brandId: string; step: number; kind: "video" | "screenshot"; onError: (e: string | null) => void }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        hidden
        multiple
        accept={kind === "video" ? "video/*" : "image/*"}
        onChange={async (e) => {
          const files = e.target.files;
          if (!files) return;
          onError(null);
          setBusy(true);
          try {
            for (const f of Array.from(files)) {
              if (f.size > MAX_UPLOAD_BYTES) throw new Error(`${f.name} is over the 50 MB storage limit on the current Supabase plan.`);
              const u = await ppuUploadUrl(brandId, step, kind, f.name);
              if (!u.ok || !u.data) throw new Error(u.ok ? "No upload URL" : u.error);
              await uploadToSignedUrl(u.data.signedUrl, f);
              const r = await ppuRegisterMedia(brandId, step, kind, u.data.path);
              if (!r.ok) throw new Error(r.error);
            }
            router.refresh();
          } catch (err) {
            onError(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {busy ? "Uploading…" : `Add ${kind}`}
      </button>
    </>
  );
}

function DeleteButton({ id, onError }: { id: string; onError: (e: string | null) => void }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <button
      type="button"
      title="Delete"
      className="absolute top-2 right-2 z-10 btn !p-1.5 bg-bad text-white opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => {
        if (!confirm("Delete this file?")) return;
        start(async () => {
          const r = await ppuDeleteMedia(id);
          if (!r.ok) onError(r.error);
          router.refresh();
        });
      }}
    >
      <Trash2 size={14} />
    </button>
  );
}

export function PpuVideos({ brandId, step, videos, isAdmin, textOnly }: { brandId: string; step: number; videos: Media[]; isAdmin: boolean; textOnly: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  if (!videos.length && !isAdmin) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="label flex items-center gap-1.5"><Video size={12} /> Upsell video</div>
        {isAdmin && <AdminUpload brandId={brandId} step={step} kind="video" onError={setErr} />}
      </div>
      {err && <p className="text-bad text-xs mb-2">{err}</p>}
      {videos.length ? (
        <div className="space-y-3">
          {videos.map((v) =>
            v.url ? (
              <div key={v.id} className="relative group rounded-md overflow-hidden border border-line bg-black">
                {isAdmin && <DeleteButton id={v.id} onError={setErr} />}
                <video src={`${v.url}#t=0.5`} controls playsInline preload="metadata" controlsList="nodownload" className="w-full max-h-[70vh] bg-black" />
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-line-strong rounded-md text-sm text-dim">{textOnly ? "Text-only upsell — no video." : "No video uploaded yet."}</div>
      )}
    </div>
  );
}

export function PpuScreenshots({ brandId, step, shots, isAdmin }: { brandId: string; step: number; shots: Media[]; isAdmin: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  if (!shots.length && !isAdmin) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="label flex items-center gap-1.5"><ImageIcon size={12} /> Page screenshots</div>
        {isAdmin && <AdminUpload brandId={brandId} step={step} kind="screenshot" onError={setErr} />}
      </div>
      {err && <p className="text-bad text-xs mb-2">{err}</p>}
      {shots.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shots.map((s) =>
            s.url ? (
              <div key={s.id} className="relative group">
                {isAdmin && <DeleteButton id={s.id} onError={setErr} />}
                <button type="button" onClick={() => setZoom(mediaSrc("res-media", s.path) ?? s.url)} className="relative block w-full aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg cursor-zoom-in">
                  {mediaSrc("res-media", s.path) ? (
                    <Image src={mediaSrc("res-media", s.path)!} alt="" fill quality={60} sizes="(min-width: 640px) 260px, 45vw" className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <img src={s.url} alt="" loading="lazy" className="w-full h-full object-cover object-top" />
                  )}
                </button>
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-line-strong rounded-md text-sm text-dim">No screenshots yet.</div>
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

/** Long scripts collapse to a preview with a fade, like the original "Read Full Script". */
export function ScriptBlock({ script }: { script: string }) {
  const [open, setOpen] = useState(false);
  const long = script.length > 900;
  return (
    <div>
      <div className={`relative whitespace-pre-line text-[0.92rem] leading-relaxed text-dim ${!open && long ? "max-h-56 overflow-hidden" : ""}`}>
        {script}
        {!open && long && <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg-panel)] to-transparent" />}
      </div>
      {long && (
        <button type="button" className="mt-2 text-xs uppercase tracking-[0.14em] text-gold hover:text-gold-soft" onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse script" : "Read full script"}
        </button>
      )}
    </div>
  );
}
