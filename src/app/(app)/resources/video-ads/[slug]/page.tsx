import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Crumbs } from "@/components/kb/bits";
import { VIDEO_AD_GUIDES, getGuide, renderGuide, videoAdsHref } from "@/lib/video-ads";
import { resHref } from "@/lib/resources";

export function generateStaticParams() {
  return VIDEO_AD_GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuide((await params).slug);
  return { title: g ? `${g.title} · Video Ads` : "Video Ads" };
}

export default async function VideoAdGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const { html, toc } = renderGuide(g.md);
  const i = VIDEO_AD_GUIDES.findIndex((x) => x.slug === g.slug);
  const prev = VIDEO_AD_GUIDES[i - 1];
  const next = VIDEO_AD_GUIDES[i + 1];

  return (
    <div className="max-w-6xl">
      <Crumbs items={[{ label: "Resources", href: resHref.hub }, { label: "Video Ads", href: videoAdsHref.hub }, { label: g.title }]} />

      <header className="mb-8 max-w-3xl">
        <div className="label mb-2">{g.kicker} · Updated {g.updated}</div>
        <h1 className="display text-[2rem] md:text-[2.6rem] leading-[1.1]">{g.title}</h1>
        <p className="text-dim mt-3 leading-relaxed">{g.summary}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Contents" className="hidden lg:block">
          <div className="sticky top-6">
            <div className="label mb-3">Contents</div>
            <ol className="space-y-1 border-l border-line">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block -ml-px border-l border-transparent pl-3 py-1 text-[0.8rem] leading-snug text-dim hover:text-ink hover:border-gold transition-colors">
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="min-w-0">
          <details className="lg:hidden card mb-5 px-4 py-3">
            <summary className="label cursor-pointer">Contents</summary>
            <ol className="mt-3 space-y-1.5">
              {toc.map((t) => (
                <li key={t.id}><a href={`#${t.id}`} className="text-sm text-dim hover:text-ink">{t.text}</a></li>
              ))}
            </ol>
          </details>
          <div className="kb-prose kb-guide card px-6 py-7 md:px-10 md:py-9" dangerouslySetInnerHTML={{ __html: html }} />

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            {prev ? (
              <Link href={videoAdsHref.guide(prev.slug)} className="btn btn-ghost max-w-[22rem]"><ArrowLeft size={15} /><span className="truncate">{prev.title}</span></Link>
            ) : <Link href={videoAdsHref.hub} className="btn btn-ghost"><ArrowLeft size={15} /> All video ad guides</Link>}
            {next ? (
              <Link href={videoAdsHref.guide(next.slug)} className="btn btn-secondary max-w-[22rem]"><span className="truncate">{next.title}</span><ArrowRight size={15} /></Link>
            ) : <Link href={videoAdsHref.hub} className="btn btn-secondary">All video ad guides <ArrowRight size={15} /></Link>}
          </div>
        </article>
      </div>
    </div>
  );
}
