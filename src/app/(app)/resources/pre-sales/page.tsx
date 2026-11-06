/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, ExternalLink, ImageIcon, Settings2 } from "lucide-react";
import { PRESALE_STYLES, adminConfigured, getPresaleList, isResourcesAdmin, resHref, styleTone } from "@/lib/resources";
import { Crumbs } from "@/components/kb/bits";
import { AdminBar } from "@/components/resources/admin-bar";

export const metadata = { title: "Pre-Sales Vault · Resources" };

const QUOTES = [
  { author: "Dan Kennedy", quote: "Model what works." },
  { author: "Jay Abraham", quote: "Your competitors can teach you everything you need to know about what works." },
  { author: "Gary Halbert", quote: "If you want to be successful, find out what the successful people are doing and do the same thing." },
  { author: "Claude Hopkins", quote: "The way to learn to write ads is to read good ads." },
  { author: "Eugene Schwartz", quote: "The copywriter's job is not to create desire, but to channel it." },
  { author: "Rosser Reeves", quote: "The consumer tends to remember just one thing from an advertisement — one strong claim." },
  { author: "Pablo Picasso", quote: "Good artists copy; great artists steal." },
  { author: "Charlie Munger", quote: "I constantly see people rise in life who are not the smartest… but they are learning machines." },
];

export default async function PreSalesVault({ searchParams }: { searchParams: Promise<{ style?: string }> }) {
  const { style } = await searchParams;
  const [all, isAdmin] = await Promise.all([getPresaleList(), isResourcesAdmin()]);
  const active = PRESALE_STYLES.find((s) => s === style) ?? "All";
  const list = active === "All" ? all : all.filter((b) => b.style === active);
  const q = QUOTES[new Date().getDate() % QUOTES.length];

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Crumbs items={[{ label: "Resources", href: resHref.hub }, { label: "Pre-Sales Vault" }]} />
        <div className="flex gap-2 shrink-0">
          {isAdmin && <Link href={resHref.presaleAdmin} className="btn btn-secondary !py-1.5 !text-xs"><Settings2 size={13} /> Admin panel</Link>}
          <AdminBar isAdmin={isAdmin} configured={adminConfigured()} />
        </div>
      </div>

      <h1 className="display text-[2.2rem] md:text-[2.8rem] leading-[1.08]">
        The <span className="italic text-gold">Pre-Sales</span> Vault
      </h1>
      <p className="text-dim mt-2 max-w-2xl">Winning advertorials and pre-sale pages, deconstructed. Study how top e-commerce brands warm cold traffic before the sales page.</p>
      <blockquote className="mt-6 mb-8 max-w-xl border-l-2 border-gold/50 pl-4">
        <p className="font-serif italic text-[1.05rem] text-ink/85 leading-relaxed">“{q.quote}”</p>
        <footer className="label mt-2">— {q.author}</footer>
      </blockquote>

      <nav aria-label="Filter by style" className="flex flex-wrap gap-2 mb-7">
        {(["All", ...PRESALE_STYLES] as const).map((s) => {
          const n = s === "All" ? all.length : all.filter((b) => b.style === s).length;
          const on = active === s;
          return (
            <Link
              key={s}
              href={s === "All" ? resHref.presale : resHref.presaleStyle(s)}
              scroll={false}
              className={`px-3 py-1.5 rounded-full border text-[0.72rem] uppercase tracking-[0.12em] transition-colors ${on ? "border-gold bg-gold-dim text-gold-soft" : "border-line-strong text-dim hover:text-ink hover:border-gold/50"}`}
            >
              {s} <span className="opacity-60 tabular-nums">({n})</span>
            </Link>
          );
        })}
      </nav>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-dim">Nothing here yet.</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((b) => (
            <article key={b.id} className="group card flex flex-col overflow-hidden transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-gold/40">
              <Link href={resHref.presaleBrand(b.slug)} className="flex flex-col flex-1 p-5">
                <h2 className="display text-[1.45rem] leading-tight mb-3 group-hover:text-gold-soft transition-colors">{b.brand_name}</h2>
                <div className="relative h-40 rounded-md overflow-hidden border border-line bg-bg mb-4">
                  {b.thumbnail ? (
                    <img src={b.thumbnail} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-mute/40"><ImageIcon size={28} strokeWidth={1} /></div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <span className={`pill pill-${styleTone[b.style] ?? "mute"}`}>{b.style}</span>
                  <span className="text-[0.66rem] uppercase tracking-[0.14em] text-mute">{b.niche}</span>
                </div>
                <p className="text-sm text-dim mb-2">{b.product_name}</p>
                <p className="font-serif italic text-[0.98rem] leading-snug text-ink/80 line-clamp-3 mb-4">“{b.headline}”</p>
                <p className="mt-auto text-[0.66rem] uppercase tracking-[0.12em] text-mute">{b.traffic_flow}</p>
              </Link>
              <div className="flex items-center justify-between px-5 py-3 border-t border-line">
                {b.live_url ? (
                  <a href={b.live_url} target="_blank" rel="noopener noreferrer" className="text-[0.68rem] uppercase tracking-[0.14em] text-gold hover:text-gold-soft inline-flex items-center gap-1.5">
                    Live URL <ExternalLink size={11} />
                  </a>
                ) : <span />}
                <Link href={resHref.presaleBrand(b.slug)} aria-label={`Open ${b.brand_name}`}><ArrowUpRight size={16} className="text-mute group-hover:text-gold transition-colors" /></Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
