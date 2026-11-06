import Link from "next/link";
import { notFound } from "next/navigation";
import { Brain, ExternalLink, FileText, Map as MapIcon, Search, Settings2, Target } from "lucide-react";
import { adminConfigured, getPresale, isResourcesAdmin, resHref, styleTone } from "@/lib/resources";
import { Crumbs } from "@/components/kb/bits";
import { AdminBar } from "@/components/resources/admin-bar";
import { PresaleScreenshots } from "@/components/resources/screenshots";

const SECTIONS: [key: string, title: string][] = [
  ["headline", "The headline"],
  ["lead", "The lead (hook extension)"],
  ["body", "The body"],
  ["bridge", "The product introduction (the bridge)"],
  ["socialProof", "The social proof stack"],
  ["cta", "The offer and CTA"],
];

export default async function PresaleBrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const isAdmin = await isResourcesAdmin();
  const b = await getPresale(slug, isAdmin);
  if (!b) notFound();
  const dd = b.deep_copywriting_breakdown ?? {};
  const flow = (b.traffic_flow || "").split("→").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <Crumbs items={[{ label: "Resources", href: resHref.hub }, { label: "Pre-Sales Vault", href: resHref.presale }, { label: b.brand_name }]} />
        <div className="flex gap-2 shrink-0">
          {isAdmin && <Link href={`${resHref.presaleAdmin}?edit=${b.slug}`} className="btn btn-secondary !py-1.5 !text-xs"><Settings2 size={13} /> Edit</Link>}
          <AdminBar isAdmin={isAdmin} configured={adminConfigured()} />
        </div>
      </div>

      <header className="card p-6 md:p-7 mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {b.status === "draft" && <span className="pill pill-warn">Draft</span>}
          <span className={`pill pill-${styleTone[b.style] ?? "mute"}`}>{b.style}</span>
          {b.hybrid_blend && <span className="text-xs text-mute">({b.hybrid_blend})</span>}
          <span className="text-[0.68rem] uppercase tracking-[0.14em] text-mute">{b.niche}</span>
          <span className="pill pill-gold">{dd.deepDive?.length ?? 0} techniques</span>
        </div>
        <h1 className="display text-[2.1rem] md:text-[2.6rem] leading-tight">{b.brand_name}</h1>
        <p className="text-dim text-lg mt-1">{b.product_name}</p>
        {b.headline && <p className="font-serif italic text-ink/80 mt-4 text-[1.05rem] leading-snug">“{b.headline}”</p>}
        {b.description && <p className="text-dim text-sm mt-3 max-w-3xl">{b.description}</p>}
        {b.live_url && (
          <a href={b.live_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-4 text-sm text-gold hover:text-gold-soft">
            View live page <ExternalLink size={13} />
          </a>
        )}
      </header>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5 mb-5">
        <section className="card p-5">
          <h2 className="text-sm font-medium text-ink mb-3">Brand context</h2>
          <table className="table">
            <tbody>
              {[["Niche", b.niche], ["Core product", b.product_name], ["Core price", b.core_price], ["Target avatar", b.target_avatar], ["Advertorial style", b.hybrid_blend ? `Hybrid (${b.hybrid_blend})` : b.style], ["Format", b.format]].map(([k, v]) => (
                <tr key={k}><td className="text-mute w-40 align-top">{k}</td><td className="text-ink">{v || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card p-5">
          <h2 className="text-sm font-medium text-ink mb-4">Traffic flow</h2>
          <ol className="flex flex-wrap items-center gap-2">
            {flow.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-md border text-sm ${s.toLowerCase().includes("advertorial") ? "border-gold bg-gold-dim text-gold-soft" : "border-line-strong text-dim"}`}>{s}</span>
                {i < flow.length - 1 && <span className="text-gold">→</span>}
              </li>
            ))}
          </ol>
          <p className="text-xs text-mute mt-4">This breakdown covers the highlighted step.</p>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <PresaleScreenshots brandId={b.id} brandName={b.brand_name} shots={b.screenshots} isAdmin={isAdmin} />
        </div>
        <section className="card p-5">
          <h2 className="text-sm font-medium text-ink flex items-center gap-2 mb-4"><FileText size={16} className="text-gold" /> Section-by-section breakdown</h2>
          <div className="space-y-3">
            {SECTIONS.map(([k, title], i) => {
              const v = (b.section_breakdown as Record<string, string>)?.[k];
              if (!v) return null;
              return (
                <div key={k} className="card-elev p-4">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-[0.7rem] text-gold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="text-ink font-medium">{title}</h3>
                  </div>
                  <p className="text-sm text-dim leading-relaxed">{v}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card p-5 md:p-7">
        <h2 className="display text-2xl flex items-center gap-2.5 mb-6"><Brain size={20} className="text-gold" /> Deep copywriting breakdown</h2>

        {dd.coreBeliefShift && (
          <div className="mb-8">
            <h3 className="label flex items-center gap-1.5 mb-2"><Target size={13} /> The core belief shift</h3>
            <div className="border-l-2 border-gold bg-gold-dim rounded-r-md px-5 py-4">
              <p className="text-ink leading-relaxed">{dd.coreBeliefShift}</p>
            </div>
          </div>
        )}

        {!!dd.readerJourney?.length && (
          <div className="mb-8">
            <h3 className="label flex items-center gap-1.5 mb-3"><MapIcon size={13} /> The reader&apos;s journey (belief engineering sequence)</h3>
            <ol className="relative space-y-3 before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-px before:bg-line-strong">
              {dd.readerJourney.map((s, i) => (
                <li key={i} className="relative flex gap-4">
                  <span className="relative z-10 h-8 w-8 shrink-0 rounded-full border border-gold bg-panel text-gold text-sm flex items-center justify-center tabular-nums">{i + 1}</span>
                  <div className="card-elev p-4 flex-1">
                    <h4 className="text-ink font-medium mb-1">{s.title}</h4>
                    <p className="text-sm text-dim leading-relaxed">{s.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {!!dd.deepDive?.length && (
          <div>
            <h3 className="label flex items-center gap-1.5 mb-3"><Search size={13} /> Deep dive: frameworks & micro-techniques</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {dd.deepDive.map((d, i) => (
                <div key={i} className={`card-elev p-4 border-l-2 ${d.type === "framework" ? "!border-l-gold" : "!border-l-info"}`}>
                  <div className={`text-[0.66rem] uppercase tracking-[0.14em] mb-1 ${d.type === "framework" ? "text-gold" : "text-info"}`}>{d.type === "framework" ? "Framework" : "Micro-technique"}</div>
                  <h4 className="text-ink font-medium mb-1">{d.name}</h4>
                  <p className="text-sm text-dim leading-relaxed">{d.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
