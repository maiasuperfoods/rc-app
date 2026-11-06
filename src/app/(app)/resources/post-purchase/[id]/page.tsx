import { notFound } from "next/navigation";
import { Brain, Box, DollarSign, Hash, Layers, Repeat, User, Video } from "lucide-react";
import { adminConfigured, getPpu, isResourcesAdmin, resHref } from "@/lib/resources";
import { Crumbs } from "@/components/kb/bits";
import { AdminBar } from "@/components/resources/admin-bar";
import { PpuScreenshots, PpuVideos, ScriptBlock } from "@/components/resources/ppu-media";

export const maxDuration = 60;

const OFFER: [key: string, label: string][] = [
  ["product", "Product"],
  ["regularPrice", "Regular"],
  ["upsellPrice", "Upsell"],
  ["discount", "Discount"],
  ["tiers", "Tiers"],
  ["guarantee", "Guarantee"],
];

export default async function PpuBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isAdmin = await isResourcesAdmin();
  const b = await getPpu(id, isAdmin);
  if (!b) notFound();
  const c = b.brand_context ?? {};
  const ctx: [typeof Hash, string, string | number | undefined][] = [
    [Hash, "Niche", c.niche],
    [Box, "Core product", c.coreProduct],
    [DollarSign, "Core price", c.coreProductPrice],
    [Layers, "Total upsells", c.totalUpsells ?? b.upsells.length],
    [Repeat, "Upsell strategy", c.upsellStrategy],
    [Video, "Format", c.format],
    [User, "Presenter", c.presenter],
  ];

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <Crumbs items={[{ label: "Resources", href: resHref.hub }, { label: "Post-Purchase Vault", href: resHref.ppu }, { label: b.brand_name }]} />
        <AdminBar isAdmin={isAdmin} configured={adminConfigured()} />
      </div>

      <header className="card p-6 md:p-7 mb-5">
        <div className="label !text-gold mb-2">Brand dossier</div>
        <h1 className="display text-[2.1rem] md:text-[2.6rem] leading-tight">{b.brand_name}</h1>
        <p className="text-dim text-lg mt-0.5">{b.core_product}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-dim">
          <span className="inline-flex items-center gap-1.5"><Hash size={13} className="text-gold" />{b.niche}</span>
          {b.presenter && <span className="inline-flex items-center gap-1.5"><User size={13} className="text-gold" />{b.presenter}</span>}
          {b.script_style && <span className="inline-flex items-center gap-1.5"><Brain size={13} className="text-gold" />{b.script_style}</span>}
        </div>
      </header>

      <section className="card p-5 mb-5">
        <h2 className="text-sm font-medium text-ink mb-4">Brand context</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {ctx.filter(([, , v]) => v !== undefined && v !== "").map(([Icon, k, v]) => (
            <div key={k} className="card-elev px-4 py-3 flex gap-3">
              <Icon size={15} className="text-mute mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-mute">{k}</div>
                <div className="text-ink text-sm font-medium leading-snug">{v}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 mb-5">
        <h2 className="text-sm font-medium text-ink mb-4">Funnel flow</h2>
        <ol className="flex flex-wrap items-stretch gap-2">
          <li className="flex items-center gap-2">
            <div className="rounded-md border border-gold bg-gold-dim px-3.5 py-2">
              <div className="text-[0.62rem] uppercase tracking-[0.14em] text-gold">Core product</div>
              <div className="text-sm text-ink">{b.core_product}</div>
            </div>
          </li>
          {b.upsells.map((u) => (
            <li key={u.step} className="flex items-center gap-2">
              <span className="text-gold">→</span>
              <a href={`#upsell-${u.step}`} className="rounded-md border border-line-strong px-3.5 py-2 hover:border-gold/60 transition-colors">
                <div className="text-[0.62rem] uppercase tracking-[0.14em] text-mute">Upsell #{u.step}</div>
                <div className="text-sm text-ink">{u.type}</div>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-6">
        {b.upsells.map((u) => {
          const offer = OFFER.filter(([k]) => (u.offer_structure as Record<string, string>)?.[k]);
          const levers = u.psych_breakdown?.levers ?? [];
          return (
            <section key={u.step} id={`upsell-${u.step}`} className="card overflow-hidden scroll-mt-6">
              <header className="px-5 md:px-6 py-4 border-b border-line bg-elev flex flex-wrap items-center gap-3">
                <span className="h-8 w-8 rounded-full border border-gold text-gold flex items-center justify-center text-sm tabular-nums">{u.step}</span>
                <h2 className="display text-xl flex-1 min-w-0">{u.title}</h2>
                <span className="pill pill-gold">{u.type}</span>
              </header>

              <div className="p-5 md:p-6 space-y-6">
                <div className="grid md:grid-cols-[1.35fr_1fr] gap-5">
                  <PpuVideos brandId={b.id} step={u.step} videos={u.videos} isAdmin={isAdmin} textOnly={u.is_text_only} />
                  {offer.length > 0 && (
                    <div>
                      <div className="label mb-2">Offer structure</div>
                      <table className="table card-elev overflow-hidden">
                        <tbody>
                          {offer.map(([k, label]) => (
                            <tr key={k}>
                              <td className="text-mute w-24 align-top">{label}</td>
                              <td className={k === "upsellPrice" ? "text-gold-soft font-medium" : k === "discount" ? "text-good" : "text-ink"}>{(u.offer_structure as Record<string, string>)[k]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <PpuScreenshots brandId={b.id} step={u.step} shots={u.screenshots} isAdmin={isAdmin} />

                {u.script && (
                  <div>
                    <div className="label mb-2">Full script</div>
                    <div className="card-elev p-4 md:p-5"><ScriptBlock script={u.script} /></div>
                  </div>
                )}

                {(levers.length > 0 || u.psych_breakdown?.whyItWorks) && (
                  <div>
                    <div className="label mb-3 flex items-center gap-1.5"><Brain size={12} /> Psychological breakdown</div>
                    {u.psych_breakdown?.whyItWorks && (
                      <div className="border-l-2 border-gold bg-gold-dim rounded-r-md px-5 py-4 mb-4">
                        <div className="text-[0.66rem] uppercase tracking-[0.14em] text-gold mb-1">Why it works</div>
                        <p className="text-ink text-sm leading-relaxed">{u.psych_breakdown.whyItWorks}</p>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-3">
                      {levers.map((l, i) => (
                        <div key={i} className="card-elev p-4">
                          <h4 className="text-ink font-medium mb-1">{l.name}</h4>
                          {l.quote && <p className="text-sm text-ink/85 mb-1.5 pl-3 border-l-2 border-gold/40">“{l.quote}”</p>}
                          <p className="text-sm text-dim leading-relaxed">{l.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {u.key_tactics?.length > 0 && (
                  <div>
                    <div className="label mb-2">Key tactics</div>
                    <div className="flex flex-wrap gap-2">
                      {u.key_tactics.map((t) => <span key={t} className="pill pill-mute !text-[0.75rem]">{t}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
