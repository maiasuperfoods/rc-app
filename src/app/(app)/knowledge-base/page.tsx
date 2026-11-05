/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { categoryStats, chaptersOf, getKbTree, kbHref, lessonsOf } from "@/lib/kb";
import { KbEmpty, KbTitle, plural } from "@/components/kb/bits";
import { DoneCount } from "@/components/kb/progress";
import { ArrowUpRight, Newspaper, Repeat } from "lucide-react";

export const metadata = { title: "Knowledge Base · Renaissance Commerce" };

export default async function KnowledgeBasePage() {
  const t = await getKbTree();
  if (!t.configured || t.categories.length === 0) return <KbEmpty />;
  const lessonTotal = t.lessons.length;

  return (
    <>
      <KbTitle title="Knowledge Base" sub={`${plural(t.categories.length, "category")} · ${plural(lessonTotal, "lesson")}`} />
      <div className="hairline mb-8" />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {t.categories.map((cat, i) => {
          const s = categoryStats(t, cat.id);
          const ids = chaptersOf(t, cat.id).flatMap((ch) => lessonsOf(t, ch.id).map((l) => l.id));
          return (
            <Link
              key={cat.id}
              href={kbHref.category(cat.id)}
              className="group card overflow-hidden flex flex-col transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_10px_40px_-12px_rgba(201,169,97,0.25)]"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-bg">
                {cat.image ? (
                  <img src={cat.image} alt="" loading={i < 3 ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,var(--gold-dim),transparent_70%)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-panel)] via-transparent to-transparent opacity-90" />
                <span className="absolute left-4 top-4 pill pill-gold backdrop-blur-sm">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="px-5 pb-5 -mt-2 relative">
                <h2 className="display text-[1.35rem] leading-snug group-hover:text-gold-soft transition-colors">{cat.title}</h2>
                <div className="text-xs text-mute mt-1.5 flex items-center gap-2">
                  <span>
                    {plural(s.chapters, "chapter")} · {plural(s.lessons, "lesson")}
                  </span>
                  <DoneCount ids={ids} className="text-gold" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="label mb-1">Resources</div>
            <h2 className="display text-2xl">Swipe files &amp; teardowns</h2>
          </div>
          <Link href="/knowledge-base/resources" className="text-sm text-gold hover:text-gold-soft">All resources</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { href: "/knowledge-base/resources/pre-sales", icon: Newspaper, title: "Pre-Sales Vault", body: "Winning advertorials and pre-sale pages, deconstructed." },
            { href: "/knowledge-base/resources/post-purchase", icon: Repeat, title: "Post-Purchase Vault", body: "Upsell funnels, offers, scripts and the psychology behind them." },
          ].map((r) => (
            <Link key={r.href} href={r.href} className="group card p-5 flex items-center gap-4 transition-colors hover:border-gold/40 hover:bg-hover">
              <span className="h-10 w-10 shrink-0 rounded-full bg-gold-dim text-gold flex items-center justify-center"><r.icon size={18} strokeWidth={1.6} /></span>
              <span className="flex-1 min-w-0">
                <span className="block display text-lg leading-tight group-hover:text-gold-soft transition-colors">{r.title}</span>
                <span className="block text-sm text-dim mt-0.5">{r.body}</span>
              </span>
              <ArrowUpRight size={17} className="text-mute group-hover:text-gold transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
