"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ExternalLink, Loader2, Pencil, Save, Sparkles, Trash2, X } from "lucide-react";
import { analyzeAndSaveDraft, deletePresale, setPresaleStatus, updatePresale } from "@/app/(app)/resources/actions";
import type { PresaleBrand, PresaleListItem } from "@/lib/resources";

const STYLES = ["Personal Story", "Exposé", "Listicle", "Hybrid"];
const EDITABLE = ["brand_name", "product_name", "niche", "style", "hybrid_blend", "target_avatar", "core_price", "headline", "description", "live_url"] as const;
type Editable = Pick<PresaleBrand, (typeof EDITABLE)[number]> & { core_belief?: string };

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="label block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

/** Review & edit a draft (or published entry) before it goes live. */
function Editor({ brand, onClose }: { brand: PresaleBrand; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Editable>({ ...Object.fromEntries(EDITABLE.map((k) => [k, brand[k] ?? ""])), core_belief: brand.deep_copywriting_breakdown?.coreBeliefShift ?? "" } as Editable);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Editable) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const patch = () => {
    const { core_belief, ...rest } = f;
    return { ...rest, hybrid_blend: f.style === "Hybrid" ? f.hybrid_blend || null : null, deep_copywriting_breakdown: { ...brand.deep_copywriting_breakdown, coreBeliefShift: core_belief } };
  };
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, close = false) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setMsg({ tone: "bad", text: r.error ?? "Failed" });
      setMsg({ tone: "good", text: ok });
      router.refresh();
      if (close) onClose();
    });

  const dd = brand.deep_copywriting_breakdown ?? {};
  return (
    <section className="card p-5 md:p-6 mb-8 border-gold/40">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="label mb-1">{brand.status === "draft" ? "Draft — review before publishing" : "Published — editing"}</div>
          <h2 className="title text-2xl">{brand.brand_name}</h2>
        </div>
        <button type="button" className="btn btn-ghost !p-2" onClick={onClose} aria-label="Close editor"><X size={15} /></button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <Field label="Brand name"><input className="input" value={f.brand_name} onChange={set("brand_name")} /></Field>
        <Field label="Product name"><input className="input" value={f.product_name} onChange={set("product_name")} /></Field>
        <Field label="Niche"><input className="input" value={f.niche} onChange={set("niche")} /></Field>
        <Field label="Advertorial style">
          <select className="input" value={f.style} onChange={set("style")}>{STYLES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        {f.style === "Hybrid" && <Field label="Hybrid blend" wide><input className="input" placeholder="Personal Story + Exposé" value={f.hybrid_blend ?? ""} onChange={set("hybrid_blend")} /></Field>}
        <Field label="Target avatar"><input className="input" value={f.target_avatar} onChange={set("target_avatar")} /></Field>
        <Field label="Core price"><input className="input" value={f.core_price} onChange={set("core_price")} /></Field>
        <Field label="Headline" wide><input className="input" value={f.headline} onChange={set("headline")} /></Field>
        <Field label="Description" wide><textarea className="input min-h-[70px]" value={f.description} onChange={set("description")} /></Field>
        <Field label="Live URL" wide><input className="input" value={f.live_url} onChange={set("live_url")} /></Field>
        <Field label="Core belief shift" wide><textarea className="input min-h-[70px]" value={f.core_belief} onChange={set("core_belief")} /></Field>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-5 text-sm">
        <div className="card-elev p-4">
          <div className="label mb-2">Reader&apos;s journey · {dd.readerJourney?.length ?? 0} steps</div>
          <ol className="space-y-1 text-dim list-decimal pl-4">{(dd.readerJourney ?? []).map((s, i) => <li key={i}>{s.title}</li>)}</ol>
        </div>
        <div className="card-elev p-4">
          <div className="label mb-2">Frameworks & techniques · {dd.deepDive?.length ?? 0}</div>
          <ul className="space-y-1 text-dim">{(dd.deepDive ?? []).map((d, i) => <li key={i}><span className={d.type === "framework" ? "text-gold" : "text-info"}>{d.type === "framework" ? "Framework" : "Technique"}</span> · {d.name}</li>)}</ul>
        </div>
      </div>

      {msg && <p className={`text-sm mb-3 ${msg.tone === "good" ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => act(() => updatePresale(brand.id, patch()), "Saved.")}><Save size={14} /> Save</button>
        {brand.status === "draft" ? (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => act(() => setPresaleStatus(brand.id, "published", patch()), "Published to the vault.", true)}><Eye size={14} /> Publish to vault</button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => act(() => setPresaleStatus(brand.id, "draft", patch()), "Moved back to drafts.", true)}><EyeOff size={14} /> Unpublish</button>
        )}
        <Link href={`/resources/pre-sales/${brand.slug}`} className="btn btn-ghost"><ExternalLink size={14} /> Open page</Link>
        <button type="button" className="btn ml-auto text-bad hover:bg-bad-dim" disabled={pending} onClick={() => confirm(`Delete ${brand.brand_name}? This removes its screenshots too.`) && act(() => deletePresale(brand.id), "Deleted.", true)}><Trash2 size={14} /> Delete</button>
      </div>
    </section>
  );
}

export function PresaleAdmin({ items, editing, ai, firecrawl }: { items: PresaleListItem[]; editing: PresaleBrand | null; ai: boolean; firecrawl: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const drafts = useMemo(() => items.filter((i) => i.status === "draft"), [items]);
  const published = useMemo(() => items.filter((i) => i.status === "published"), [items]);
  const open = (slug: string) => router.push(`?edit=${encodeURIComponent(slug)}`, { scroll: false });

  return (
    <>
      <section className="card p-5 md:p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-gold" />
          <h2 className="text-sm font-medium text-ink">Auto-analyze a new advertorial</h2>
        </div>
        <p className="text-sm text-dim mb-4">Paste any advertorial or pre-sale page. It gets scraped, broken down by AI and saved as a draft for you to review.</p>
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            start(async () => {
              const r = await analyzeAndSaveDraft(url);
              if (!r.ok) return setErr(r.error);
              setUrl("");
              if (r.data?.slug) open(r.data.slug);
              router.refresh();
            });
          }}
        >
          <input className="input" type="text" inputMode="url" placeholder="https://example.com/advertorial" value={url} onChange={(e) => setUrl(e.target.value)} disabled={pending} />
          <button className="btn btn-primary justify-center sm:w-56" disabled={pending || !url.trim() || !ai}>
            {pending ? <><Loader2 size={14} className="animate-spin" /> Analyzing… 30–90s</> : <><Sparkles size={14} /> Analyze</>}
          </button>
        </form>
        {err && <p className="text-bad text-sm mt-3">{err}</p>}
        {!ai && <p className="text-warn text-xs mt-3">AI isn&apos;t connected: add <code className="formula">ANTHROPIC_API_KEY</code> to the Vercel project to turn this on.</p>}
        {ai && <p className="text-mute text-xs mt-3">A full-page screenshot is captured automatically{firecrawl ? "" : " (free capture service; add more on the entry's page if it misses anything)"}.</p>}
      </section>

      {editing && <Editor key={editing.id} brand={editing} onClose={() => router.push("?", { scroll: false })} />}

      {[["Drafts", drafts] as const, ["Published", published] as const].map(([title, list]) => (
        <section key={title} className="mb-8">
          <h2 className="label mb-3">{title} · {list.length}</h2>
          {list.length === 0 ? (
            <div className="card p-6 text-center text-sm text-dim">{title === "Drafts" ? "No drafts. Analyze a page to create one." : "Nothing published yet."}</div>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {list.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-ink font-medium truncate">{b.brand_name}</div>
                    <div className="text-xs text-mute truncate">{b.product_name} · {b.niche} · {b.style}</div>
                  </div>
                  <button type="button" className="btn btn-ghost !py-1 !px-2.5 !text-xs" onClick={() => open(b.slug)}><Pencil size={12} /> {b.status === "draft" ? "Review" : "Edit"}</button>
                  {b.status === "draft" && (
                    <button type="button" className="btn btn-primary !py-1 !px-2.5 !text-xs" disabled={pending} onClick={() => start(async () => { const r = await setPresaleStatus(b.id, "published"); if (!r.ok) setErr(r.error); router.refresh(); })}>Publish</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
