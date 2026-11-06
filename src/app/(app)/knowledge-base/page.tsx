/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { categoryStats, chaptersOf, getKbTree, kbHref, lessonsOf } from "@/lib/kb";
import { KbEmpty, KbTitle, plural } from "@/components/kb/bits";
import { DoneCount } from "@/components/kb/progress";

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
    </>
  );
}
