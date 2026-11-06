"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold, Code, Eye, FileCode2, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Save, SquareTerminal, Strikethrough, Underline, Undo2, Upload, Video, X,
} from "lucide-react";
import { kbUpdate, kbUploadUrl } from "@/app/(app)/knowledge-base/admin/actions";
import { MAX_UPLOAD_BYTES, uploadToSignedUrl } from "@/components/resources/upload";
import { mediaSrc } from "@/lib/media";

export interface EditableLesson {
  id: string;
  title: string;
  content: string;
  video: string | null; // playable (signed) URL
  video_url: string | null;
  video_path: string | null;
}

/** Blocks the visual editor would drop: copyable prompt boxes, built-in guides, embeds. */
const SPECIAL = /kb-prompt|<!--rc-guide:|<iframe|<video|<script|<table/i;

const PROMPT_BLOCK = `<div class="kb-prompt"><div class="kb-prompt-head">Prompt · what to paste it into and what to replace</div><pre class="kb-prompt-text">Paste the prompt here.</pre></div>`;

// keep inline sizing on images imported from the old course (e.g. width:50%)
const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: null, parseHTML: (el) => el.getAttribute("style"), renderHTML: (a) => (a.style ? { style: a.style } : {}) },
    };
  },
});

function Tool({ on, label, onClick, children, disabled }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-8 px-1.5 grid place-items-center rounded-md text-dim hover:text-ink hover:bg-hover disabled:opacity-40 ${on ? "bg-gold-dim text-gold" : ""}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ ed, onImage, onLink }: { ed: Editor; onImage: () => void; onLink: () => void }) {
  const c = () => ed.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-line sticky top-0 bg-panel z-10">
      <Tool label="Heading" on={ed.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Tool>
      <Tool label="Subheading" on={ed.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Tool>
      <span className="w-px h-5 bg-line mx-1" />
      <Tool label="Bold" on={ed.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold size={15} /></Tool>
      <Tool label="Italic" on={ed.isActive("italic")} onClick={() => c().toggleItalic().run()}><Italic size={15} /></Tool>
      <Tool label="Underline" on={ed.isActive("underline")} onClick={() => c().toggleUnderline().run()}><Underline size={15} /></Tool>
      <Tool label="Strikethrough" on={ed.isActive("strike")} onClick={() => c().toggleStrike().run()}><Strikethrough size={15} /></Tool>
      <Tool label="Inline code" on={ed.isActive("code")} onClick={() => c().toggleCode().run()}><Code size={15} /></Tool>
      <span className="w-px h-5 bg-line mx-1" />
      <Tool label="Bulleted list" on={ed.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List size={16} /></Tool>
      <Tool label="Numbered list" on={ed.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></Tool>
      <Tool label="Quote" on={ed.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}><Quote size={15} /></Tool>
      <Tool label="Divider" onClick={() => c().setHorizontalRule().run()}><Minus size={16} /></Tool>
      <span className="w-px h-5 bg-line mx-1" />
      <Tool label="Link" on={ed.isActive("link")} onClick={onLink}><Link2 size={15} /></Tool>
      <Tool label="Image" onClick={onImage}><ImagePlus size={15} /></Tool>
      <span className="w-px h-5 bg-line mx-1" />
      <Tool label="Undo" disabled={!ed.can().undo()} onClick={() => c().undo().run()}><Undo2 size={15} /></Tool>
      <Tool label="Redo" disabled={!ed.can().redo()} onClick={() => c().redo().run()}><Redo2 size={15} /></Tool>
    </div>
  );
}

export function LessonEditor({ lesson, backHref }: { lesson: EditableLesson; backHref: string }) {
  const router = useRouter();
  const special = SPECIAL.test(lesson.content);
  const [mode, setMode] = useState<"visual" | "html" | "preview">(special ? "html" : "visual");
  const [title, setTitle] = useState(lesson.title);
  const [html, setHtml] = useState(lesson.content);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad" | "info"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState(lesson.video_path ? "" : lesson.video_url ?? "");
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const hasSpecial = useMemo(() => SPECIAL.test(html), [html]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true } }), SizedImage],
    content: special ? "" : lesson.content,
    editorProps: { attributes: { class: "kb-prose min-h-[420px] px-6 py-6 md:px-10 outline-none" } },
    onUpdate: ({ editor: e }) => {
      setHtml(e.getHTML());
      setDirty(true);
    },
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const switchMode = (m: typeof mode) => {
    if (m === mode) return;
    if (m === "visual") {
      if (hasSpecial) return setMsg({ tone: "info", text: "This lesson has a prompt box, a built-in guide, a table or an embed, which the visual editor can't keep. Edit it in HTML." });
      editor?.commands.setContent(html, { emitUpdate: false });
    }
    setMsg(null);
    setMode(m);
  };

  const upload = async (purpose: "video" | "lesson-image", file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is over the 50 MB limit of the current storage plan.`);
    const u = await kbUploadUrl(purpose, file.name);
    if (!u.ok) throw new Error(u.error);
    await uploadToSignedUrl(u.data!.signedUrl, file);
    return u.data!.path;
  };

  const insertHtmlAtCursor = (snippet: string) => {
    const el = area.current;
    if (!el) return setHtml((h) => h + snippet);
    const { selectionStart: a, selectionEnd: b } = el;
    setHtml((h) => h.slice(0, a) + snippet + h.slice(b));
    setDirty(true);
  };

  const onImage = async (file: File) => {
    setUploading("Uploading image");
    setMsg(null);
    try {
      const path = await upload("lesson-image", file);
      const src = mediaSrc("kb-media", path)!;
      if (mode === "visual" && editor) editor.chain().focus().setImage({ src, alt: "" }).run();
      else insertHtmlAtCursor(`<p><img src="${src}" alt=""></p>`);
      setDirty(true);
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(null);
    }
  };

  const saveVideo = (patch: { video_path?: string | null; video_url?: string | null }, note: string) =>
    start(async () => {
      const r = await kbUpdate("lesson", lesson.id, patch);
      if (!r.ok) return setMsg({ tone: "bad", text: r.error });
      setMsg({ tone: "ok", text: note });
      router.refresh();
    });

  const onVideo = async (file: File) => {
    setUploading(`Uploading ${file.name}`);
    setMsg(null);
    try {
      const path = await upload("video", file);
      saveVideo({ video_path: path }, "Video uploaded and saved.");
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(null);
    }
  };

  const save = (leave: boolean) =>
    start(async () => {
      if (!title.trim()) return setMsg({ tone: "bad", text: "The lesson needs a title." });
      const content = mode === "visual" && editor ? editor.getHTML() : html;
      const r = await kbUpdate("lesson", lesson.id, { title: title.trim(), content: content === "<p></p>" ? "" : content });
      if (!r.ok) return setMsg({ tone: "bad", text: r.error });
      setDirty(false);
      if (leave) router.push(backHref);
      else {
        setMsg({ tone: "ok", text: "Saved. Students see it within a minute." });
        router.refresh();
      }
    });

  const busy = pending || Boolean(uploading);

  return (
    <div className="space-y-5 max-w-[960px]">
      <input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImage(f); e.target.value = ""; }} />
      <input ref={vidInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onVideo(f); e.target.value = ""; }} />

      <div className="flex flex-wrap items-center gap-2 sticky top-0 z-20 -mx-1 px-1 py-2 bg-[var(--bg)]/90 backdrop-blur">
        <Link href={backHref} className="btn btn-ghost !py-1.5 !text-xs"><X size={13} /> Close</Link>
        <span className="text-xs text-mute">{uploading ? `${uploading}…` : dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn btn-secondary !py-1.5 !text-xs" disabled={busy || !dirty} onClick={() => save(false)}><Save size={13} /> Save</button>
          <button type="button" className="btn btn-primary !py-1.5 !text-xs" disabled={busy} onClick={() => save(true)}>Save and view</button>
        </div>
      </div>

      {msg && <div className={`rounded-md px-3 py-2 text-sm ${msg.tone === "bad" ? "bg-bad-dim text-bad" : msg.tone === "ok" ? "bg-good-dim text-good" : "bg-gold-dim text-gold-soft"}`}>{msg.text}</div>}

      <div>
        <label className="label" htmlFor="lesson-title">Lesson title</label>
        <input id="lesson-title" className="input mt-1 !text-lg" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
      </div>

      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-ink font-medium"><Video size={15} className="text-gold" /> Video</div>
        {lesson.video ? (
          <video key={lesson.video} src={`${lesson.video}#t=0.5`} controls preload="metadata" className="w-full max-w-xl rounded-md border border-line bg-black aspect-video" />
        ) : (
          <p className="text-sm text-dim">No video on this lesson.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary !py-1.5 !text-xs" disabled={busy} onClick={() => vidInput.current?.click()}><Upload size={13} /> {lesson.video ? "Replace with a file" : "Upload a video file"}</button>
          {lesson.video && <button type="button" className="btn btn-ghost !py-1.5 !text-xs text-bad" disabled={busy} onClick={() => saveVideo({ video_path: null, video_url: null }, "Video removed.")}>Remove video</button>}
          <span className="text-xs text-mute">MP4 or WebM, up to 50 MB.</span>
        </div>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); saveVideo({ video_path: null, video_url: videoUrl.trim() || null }, videoUrl.trim() ? "Video link saved." : "Video removed."); }}>
          <input className="input flex-1 min-w-60 !text-sm" placeholder="Or paste a direct link to a video file (https://…/video.mp4)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
          <button className="btn btn-ghost !py-1.5 !text-xs" disabled={busy}>Use link</button>
        </form>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="label mr-auto">Lesson content</div>
          <div className="inline-flex rounded-md border border-line overflow-hidden text-xs" role="group" aria-label="Editor mode">
            {([["visual", "Visual", Eye], ["html", "HTML", FileCode2], ["preview", "Preview", Eye]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => switchMode(k)} className={`px-3 py-1.5 inline-flex items-center gap-1.5 ${mode === k ? "bg-gold-dim text-gold" : "text-dim hover:text-ink"}`}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost !py-1.5 !text-xs" disabled={busy} onClick={() => imgInput.current?.click()}><ImagePlus size={13} /> Add image</button>
          <button
            type="button"
            className="btn btn-ghost !py-1.5 !text-xs"
            title="A box with a Copy button, for prompts students paste into Manus, Claude or ChatGPT"
            onClick={() => {
              if (mode !== "html") {
                const current = mode === "visual" && editor ? editor.getHTML() : html;
                setHtml(current + PROMPT_BLOCK);
                setMode("html");
              } else insertHtmlAtCursor(PROMPT_BLOCK);
              setDirty(true);
              setMsg({ tone: "info", text: "Prompt box added. Edit its label and text in the HTML: the label is inside kb-prompt-head, the prompt inside kb-prompt-text." });
            }}
          >
            <SquareTerminal size={13} /> Add prompt box
          </button>
        </div>

        {mode === "visual" && editor && (
          <div className="card overflow-hidden">
            <Toolbar ed={editor} onImage={() => imgInput.current?.click()} onLink={() => { setLinkUrl(editor.getAttributes("link").href ?? ""); setLinkOpen(true); }} />
            {linkOpen && (
              <form
                className="flex gap-2 px-3 py-2 border-b border-line bg-bg"
                onSubmit={(e) => {
                  e.preventDefault();
                  const u = linkUrl.trim();
                  const ch = editor.chain().focus().extendMarkRange("link");
                  if (u) ch.setLink({ href: /^(https?:|mailto:|\/)/.test(u) ? u : `https://${u}` }).run();
                  else ch.unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                <input autoFocus className="input flex-1 !text-sm" placeholder="https://… (leave empty to remove the link)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                <button className="btn btn-primary !py-1 !text-xs">Apply</button>
                <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={() => setLinkOpen(false)}>Cancel</button>
              </form>
            )}
            <EditorContent editor={editor} />
          </div>
        )}

        {mode === "html" && (
          <textarea
            ref={area}
            value={html}
            onChange={(e) => { setHtml(e.target.value); setDirty(true); }}
            spellCheck={false}
            className="input w-full min-h-[520px] font-mono !text-[12.5px] leading-relaxed"
            aria-label="Lesson HTML"
          />
        )}

        {mode === "preview" && <div className="kb-prose card px-6 py-7 md:px-10 md:py-9" dangerouslySetInnerHTML={{ __html: html }} />}

        <p className="text-xs text-mute mt-2">
          {hasSpecial
            ? "This lesson contains blocks the visual editor can't keep (a prompt box, a built-in guide, a table or an embed), so it opens in HTML. Use Preview to check it."
            : "Visual edits the text directly. HTML shows the source, for prompt boxes or anything the toolbar doesn't cover."}
        </p>
      </section>
    </div>
  );
}
