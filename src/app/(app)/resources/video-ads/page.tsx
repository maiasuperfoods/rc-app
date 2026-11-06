import Link from "next/link";
import { ArrowUpRight, BookOpen, Users } from "lucide-react";
import { Crumbs } from "@/components/kb/bits";
import { VIDEO_AD_GUIDES, renderGuide, videoAdsHref } from "@/lib/video-ads";
import { resHref } from "@/lib/resources";

export const metadata = { title: "Video Ads · Resources" };

const ICONS: Record<string, typeof BookOpen> = { formats: BookOpen, "hiring-editors": Users };

export default function VideoAdsHub() {
  return (
    <div className="max-w-5xl">
      <Crumbs items={[{ label: "Resources", href: resHref.hub }, { label: "Video Ads" }]} />
      <h1 className="display text-[2.2rem] md:text-[2.8rem] leading-[1.08]">
        <span className="italic text-gold">Video</span> Ads
      </h1>
      <p className="text-dim mt-2 max-w-2xl">The formats we run, how each one is built and why it converts, and how to hire the editors who cut them.</p>
      <div className="hairline mt-7 mb-7" />

      <div className="grid gap-5 md:grid-cols-2">
        {VIDEO_AD_GUIDES.map((g) => {
          const Icon = ICONS[g.slug] ?? BookOpen;
          const sections = renderGuide(g.md).toc.length;
          return (
            <Link key={g.slug} href={videoAdsHref.guide(g.slug)} className="group card p-6 flex flex-col transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_10px_40px_-12px_rgba(201,169,97,0.25)]">
              <div className="flex items-center justify-between mb-6">
                <span className="h-11 w-11 rounded-full bg-gold-dim text-gold flex items-center justify-center"><Icon size={20} strokeWidth={1.6} /></span>
                <ArrowUpRight size={18} className="text-mute group-hover:text-gold transition-colors" />
              </div>
              <div className="label mb-1">{g.kicker}</div>
              <h2 className="display text-[1.55rem] leading-tight group-hover:text-gold-soft transition-colors">{g.title}</h2>
              <p className="text-dim text-sm mt-2 leading-relaxed flex-1">{g.summary}</p>
              <div className="text-xs text-mute mt-5">{sections} sections · Updated {g.updated}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
