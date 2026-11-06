import Link from "next/link";
import { ArrowUpRight, Newspaper, Repeat } from "lucide-react";
import { getPpuList, getPresaleList, resHref } from "@/lib/resources";
import { Crumbs, KbTitle } from "@/components/kb/bits";

export const metadata = { title: "Resources · Renaissance Commerce" };

export default async function ResourcesHub() {
  const [pre, ppu] = await Promise.all([getPresaleList(), getPpuList()]);
  const cards = [
    {
      href: resHref.presale,
      icon: Newspaper,
      title: "Pre-Sales Vault",
      kicker: "Advertorials",
      body: "Winning advertorials and pre-sale pages, deconstructed. See how top e-commerce brands warm cold traffic before the sales page.",
      meta: `${pre.length} breakdowns`,
    },
    {
      href: resHref.ppu,
      icon: Repeat,
      title: "Post-Purchase Vault",
      kicker: "Upsell funnels",
      body: "How successful brands use post-purchase upsell videos to raise AOV: funnels, offers, full scripts and the psychology behind them.",
      meta: `${ppu.length} brand dossiers · ${ppu.reduce((n, b) => n + b.upsell_count, 0)} upsells`,
    },
  ];
  return (
    <div className="max-w-5xl">
      <Crumbs items={[{ label: "Resources" }]} />
      <KbTitle title="Resources" sub="Swipe files and teardowns to study alongside the course." />
      <div className="hairline mb-8" />
      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group card p-6 flex flex-col transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_10px_40px_-12px_rgba(201,169,97,0.25)]">
            <div className="flex items-center justify-between mb-6">
              <span className="h-11 w-11 rounded-full bg-gold-dim text-gold flex items-center justify-center"><c.icon size={20} strokeWidth={1.6} /></span>
              <ArrowUpRight size={18} className="text-mute group-hover:text-gold transition-colors" />
            </div>
            <div className="label mb-1">{c.kicker}</div>
            <h2 className="display text-[1.7rem] leading-tight group-hover:text-gold-soft transition-colors">{c.title}</h2>
            <p className="text-dim text-sm mt-2 leading-relaxed flex-1">{c.body}</p>
            <div className="text-xs text-gold mt-5">{c.meta}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
