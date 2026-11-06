"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Link2, Loader2, Trash2, Upload, X } from "lucide-react";
import { presaleDeleteShot, presaleRegisterShot, presaleShotFromUrl, presaleUploadUrl } from "@/app/(app)/resources/actions";
import { MAX_UPLOAD_BYTES, uploadToSignedUrl } from "./upload";

type Shot = { id: string; url: string | null };

/** Click-to-zoom viewer for tall page screenshots. */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-y-auto" onClick={onClose} role="dialog" aria-modal>
      <button type="button" className="fixed top-4 right-4 btn btn-ghost !bg-black/50" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
      <img src={src} alt="" className="mx-auto my-10 max-w-[min(1000px,92vw)] rounded-md border border-line" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

/** Pre-Sales Vault screenshots with admin upload / add-by-URL / delete. */
export function PresaleScreenshots({ brandId, brandName, shots, isAdmin }: { brandId: string; brandName: string; shots: Shot[]; isAdmin: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const [, start] = useTransition();

  async function uploadFiles(files: FileList) {
    setErr(null);
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > MAX_UPLOAD_BYTES) throw new Error(`${f.name} is over 50 MB.`);
        const u = await presaleUploadUrl(brandId, f.name);
        if (!u.ok || !u.data) throw new Error(u.ok ? "No upload URL" : u.error);
        await uploadToSignedUrl(u.data.signedUrl, f);
        const reg = await presaleRegisterShot(brandId, u.data.path);
        if (!reg.ok) throw new Error(reg.error);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-medium text-ink flex items-center gap-2">
          <ImageIcon size={16} className="text-gold" /> Pre-sales screenshots
        </h2>
        {isAdmin && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
            <button type="button" className="btn btn-primary !py-1.5 !text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {busy ? "Uploading…" : "Upload"}
            </button>
            <button type="button" className="btn btn-ghost !py-1.5 !text-xs" onClick={() => setUrlOpen((v) => !v)}>
              <Link2 size={13} /> Add URL
            </button>
          </div>
        )}
      </div>

      {isAdmin && urlOpen && (
        <form
          className="flex gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            setBusy(true);
            start(async () => {
              const r = await presaleShotFromUrl(brandId, url.trim());
              setBusy(false);
              if (!r.ok) return setErr(r.error);
              setUrl("");
              setUrlOpen(false);
              router.refresh();
            });
          }}
        >
          <input className="input" type="url" placeholder="https://… image link" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !url.trim()}>Add</button>
        </form>
      )}
      {err && <p className="text-bad text-xs mb-3">{err}</p>}

      {shots.length > 0 ? (
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {shots.map((s, i) =>
            s.url ? (
              <div key={s.id} className="relative group">
                <button type="button" className="block w-full cursor-zoom-in" onClick={() => setZoom(s.url)}>
                  <img src={s.url} alt={`${brandName} pre-sale page ${i + 1}`} loading="lazy" decoding="async" className="w-full rounded-md border border-line" />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    title="Delete screenshot"
                    className="absolute top-2 right-2 btn !p-1.5 bg-bad text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      if (!confirm("Delete this screenshot?")) return;
                      start(async () => {
                        const r = await presaleDeleteShot(s.id);
                        if (!r.ok) setErr(r.error);
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-line-strong rounded-md">
          <p className="text-dim text-sm">{isAdmin ? "No screenshots yet. Upload some." : "Screenshots coming soon"}</p>
        </div>
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </section>
  );
}
