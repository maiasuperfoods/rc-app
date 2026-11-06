"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ImagePlus, Pencil, Plus, Trash2, Video, X } from "lucide-react";
import type { KbTree } from "@/lib/kb";
import { mediaSrc } from "@/lib/media";
import { kbCreate, kbDelete, kbMove, kbReorder, kbUpdate, kbUploadUrl } from "@/app/(app)/knowledge-base/admin/actions";
import { uploadToSignedUrl, MAX_UPLOAD_BYTES } from "@/components/resources/upload";

type Kind = "category" | "chapter" | "lesson";
type Act = (label: string, fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;

/** Text that saves when you press Enter or leave the field, if it changed. */
function Inline({ value, onSave, className = "", placeholder, multiline }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string; multiline?: boolean }) {
  const [v, setV] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    // the saved value changed underneath (after a refresh): show it
    setPrev(value);
    setV(value);
  }
  const commit = () => {
    const t = v.trim();
    if (t === value.trim()) return;
    if (!t && !multiline) return setV(value);
    onSave(multiline ? v : t);
  };
  const common = {
    value: v,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: commit,
    className: `w-full bg-transparent border border-transparent hover:border-line focus:border-gold/60 focus:bg-bg rounded-md px-2 py-1 outline-none transition-colors ${className}`,
  };
  return multiline ? (
    <textarea {...common} rows={2} />
  ) : (
    <input
      {...common}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setV(value); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

/** Two-step delete so nothing goes on a single click. */
function DeleteButton({ what, onConfirm, disabled }: { what: string; onConfirm: () => void; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button type="button" className="btn !py-1 !px-2 !text-xs bg-bad-dim text-bad border border-bad/40" onClick={onConfirm} disabled={disabled}>
      Delete {what}?
    </button>
  ) : (
    <button type="button" title={`Delete ${what}`} aria-label={`Delete ${what}`} className="btn btn-ghost !p-1.5 text-mute hover:text-bad" onClick={() => setArmed(true)} disabled={disabled}>
      <Trash2 size={14} />
    </button>
  );
}

function Order({ i, n, onMove, disabled }: { i: number; n: number; onMove: (to: number) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex">
      <button type="button" aria-label="Move up" title="Move up" className="btn btn-ghost !p-1.5 text-mute" disabled={disabled || i === 0} onClick={() => onMove(i - 1)}><ArrowUp size={14} /></button>
      <button type="button" aria-label="Move down" title="Move down" className="btn btn-ghost !p-1.5 text-mute" disabled={disabled || i === n - 1} onClick={() => onMove(i + 1)}><ArrowDown size={14} /></button>
    </span>
  );
}

const swap = (ids: string[], from: number, to: number) => {
  const a = [...ids];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
};

export function CourseEditor({ tree }: { tree: KbTree }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgFor, setImgFor] = useState<string | null>(null);

  const act: Act = (label, fn, after) => {
    setErr(null);
    setBusy(label);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) return setErr(r.error ?? "Failed");
      after?.();
      router.refresh();
    });
  };
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const chaptersOf = (catId: string) => tree.chapters.filter((c) => c.category_id === catId);
  const lessonsOf = (chId: string) => tree.lessons.filter((l) => l.chapter_id === chId);
  const reorder = (kind: Kind, ids: string[], from: number, to: number) => act("Reordering", () => kbReorder(kind, swap(ids, from, to)));
  const create = (kind: Kind, parent: string | null, openId?: string) => act("Adding", () => kbCreate(kind, parent), () => openId && setOpen((o) => ({ ...o, [openId]: true })));

  const uploadCategoryImage = async (catId: string, file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) return setErr(`${file.name} is over 50 MB.`);
    setErr(null);
    setBusy("Uploading image");
    try {
      const u = await kbUploadUrl("category", file.name);
      if (!u.ok) throw new Error(u.error);
      await uploadToSignedUrl(u.data!.signedUrl, file);
      const r = await kbUpdate("category", catId, { image_path: u.data!.path });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const working = pending || Boolean(busy);

  return (
    <div className="space-y-4 max-w-4xl">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && imgFor) void uploadCategoryImage(imgFor, f);
          e.target.value = "";
        }}
      />
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-[var(--bg)]/90 backdrop-blur flex items-center gap-3 min-h-10">
        {busy ? <span className="text-xs text-gold">{busy}…</span> : <span className="text-xs text-mute">Changes save as you go. Titles save when you press Enter or click away.</span>}
        {err && <span className="text-xs text-bad ml-auto">{err}</span>}
      </div>

      {tree.categories.map((cat, ci) => {
        const chs = chaptersOf(cat.id);
        const isOpen = open[cat.id] ?? false;
        const img = mediaSrc("kb-media", cat.image_path) ?? cat.image;
        return (
          <section key={cat.id} className="card">
            <div className="flex items-start gap-3 p-4">
              <button type="button" className="btn btn-ghost !p-1.5 mt-1" onClick={() => toggle(cat.id)} aria-expanded={isOpen} aria-label={isOpen ? "Collapse" : "Expand"}>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <button
                type="button"
                title={img ? "Replace image" : "Add image"}
                className="relative shrink-0 w-24 aspect-[16/10] rounded-md overflow-hidden border border-line bg-bg grid place-items-center text-mute hover:border-gold/60"
                onClick={() => { setImgFor(cat.id); fileRef.current?.click(); }}
                disabled={working}
              >
                {img ? <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <ImagePlus size={18} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="label mb-0.5">Category {ci + 1}</div>
                <Inline value={cat.title} className="text-ink font-medium text-base -ml-2" onSave={(v) => act("Saving", () => kbUpdate("category", cat.id, { title: v }))} />
                <Inline multiline value={cat.description} placeholder="Short description shown on the course home" className="text-sm text-dim -ml-2 resize-y" onSave={(v) => act("Saving", () => kbUpdate("category", cat.id, { description: v }))} />
                <div className="text-xs text-mute mt-1">{chs.length} chapter{chs.length === 1 ? "" : "s"} · {chs.reduce((n, c) => n + lessonsOf(c.id).length, 0)} lessons
                  {img && <button type="button" className="ml-3 text-mute hover:text-bad" onClick={() => act("Removing image", () => kbUpdate("category", cat.id, { image_path: null }))}>Remove image</button>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Order i={ci} n={tree.categories.length} disabled={working} onMove={(to) => reorder("category", tree.categories.map((c) => c.id), ci, to)} />
                <DeleteButton what="category and everything in it" disabled={working} onConfirm={() => act("Deleting", () => kbDelete("category", cat.id))} />
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-line px-4 py-3 space-y-3">
                {chs.map((ch, hi) => {
                  const les = lessonsOf(ch.id);
                  const chOpen = open[ch.id] ?? true;
                  return (
                    <div key={ch.id} className="rounded-lg border border-line bg-bg/40">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button type="button" className="btn btn-ghost !p-1" onClick={() => toggle(ch.id)} aria-expanded={chOpen} aria-label={chOpen ? "Collapse" : "Expand"}>
                          {chOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <Inline value={ch.icon ?? ""} placeholder="🙂" className="!w-12 text-center" onSave={(v) => act("Saving", () => kbUpdate("chapter", ch.id, { icon: v || null }))} />
                        <div className="flex-1 min-w-0"><Inline value={ch.title} className="text-ink font-medium" onSave={(v) => act("Saving", () => kbUpdate("chapter", ch.id, { title: v }))} /></div>
                        <select
                          className="input !w-auto !py-1 !text-xs max-w-40"
                          value={cat.id}
                          aria-label="Move chapter to category"
                          disabled={working}
                          onChange={(e) => act("Moving", () => kbMove("chapter", ch.id, e.target.value))}
                        >
                          {tree.categories.map((c) => <option key={c.id} value={c.id}>{c.id === cat.id ? "Move to…" : c.title}</option>)}
                        </select>
                        <Order i={hi} n={chs.length} disabled={working} onMove={(to) => reorder("chapter", chs.map((c) => c.id), hi, to)} />
                        <DeleteButton what="chapter and its lessons" disabled={working} onConfirm={() => act("Deleting", () => kbDelete("chapter", ch.id))} />
                      </div>
                      {chOpen && (
                        <ul className="border-t border-line divide-y divide-line">
                          {les.map((l, li) => (
                            <li key={l.id} className="flex items-center gap-2 pl-10 pr-3 py-1.5">
                              <span className="text-xs text-mute tabular-nums w-5">{li + 1}</span>
                              {l.has_video && <Video size={13} className="text-gold shrink-0" aria-label="Has video" />}
                              <div className="flex-1 min-w-0"><Inline value={l.title} className="text-sm text-dim" onSave={(v) => act("Saving", () => kbUpdate("lesson", l.id, { title: v }))} /></div>
                              <Link href={`/knowledge-base/lesson/${l.id}/edit`} className="btn btn-ghost !py-1 !px-2 !text-xs"><Pencil size={12} /> Edit</Link>
                              <select
                                className="input !w-auto !py-1 !text-xs max-w-36"
                                value={ch.id}
                                aria-label="Move lesson to chapter"
                                disabled={working}
                                onChange={(e) => act("Moving", () => kbMove("lesson", l.id, e.target.value))}
                              >
                                {tree.categories.map((c) => (
                                  <optgroup key={c.id} label={c.title}>
                                    {chaptersOf(c.id).map((x) => <option key={x.id} value={x.id}>{x.id === ch.id ? "Move to…" : x.title}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                              <Order i={li} n={les.length} disabled={working} onMove={(to) => reorder("lesson", les.map((x) => x.id), li, to)} />
                              <DeleteButton what="lesson" disabled={working} onConfirm={() => act("Deleting", () => kbDelete("lesson", l.id))} />
                            </li>
                          ))}
                          <li className="pl-10 pr-3 py-2">
                            <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={working} onClick={() => create("lesson", ch.id, ch.id)}><Plus size={12} /> Add lesson</button>
                          </li>
                        </ul>
                      )}
                    </div>
                  );
                })}
                <button type="button" className="btn btn-secondary !py-1.5 !text-xs" disabled={working} onClick={() => create("chapter", cat.id, cat.id)}><Plus size={13} /> Add chapter</button>
              </div>
            )}
          </section>
        );
      })}

      <button type="button" className="btn btn-primary" disabled={working} onClick={() => create("category", null)}><Plus size={14} /> Add category</button>
      {tree.categories.length === 0 && <p className="text-sm text-dim flex items-center gap-2"><X size={14} /> No categories yet.</p>}
    </div>
  );
}
