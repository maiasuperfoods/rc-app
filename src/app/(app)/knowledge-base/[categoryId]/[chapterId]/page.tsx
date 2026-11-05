import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, PlayCircle } from "lucide-react";
import { getKbTree, kbHref, lessonsOf } from "@/lib/kb";
import { Crumbs, KbEmpty, KbTitle, plural } from "@/components/kb/bits";
import { DoneDot } from "@/components/kb/progress";

export default async function ChapterPage({ params }: { params: Promise<{ categoryId: string; chapterId: string }> }) {
  const { categoryId, chapterId } = await params;
  const t = await getKbTree();
  if (!t.configured) return <KbEmpty />;
  const cat = t.categories.find((c) => c.id === categoryId);
  const ch = t.chapters.find((c) => c.id === chapterId && c.category_id === categoryId);
  if (!cat || !ch) notFound();
  const lessons = lessonsOf(t, ch.id);

  return (
    <div className="max-w-4xl">
      <Crumbs items={[{ label: "Knowledge Base", href: kbHref.home }, { label: cat.title, href: kbHref.category(cat.id) }, { label: ch.title }]} />
      <KbTitle title={`${ch.icon ? `${ch.icon} ` : ""}${ch.title}`} sub={plural(lessons.length, "lesson")} />

      <ol className="card divide-y divide-line overflow-hidden">
        {lessons.map((l, i) => (
          <li key={l.id}>
            <Link href={kbHref.lesson(l.id)} className="group flex items-center gap-4 px-4 py-3.5 md:px-5 transition-colors hover:bg-hover">
              <span className="w-6 text-xs text-mute tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <DoneDot id={l.id} size={16} />
              <span className="flex-1 min-w-0 text-[0.92rem] text-ink group-hover:text-gold-soft transition-colors">{l.title}</span>
              {l.has_video && <PlayCircle size={16} strokeWidth={1.75} className="text-gold shrink-0" aria-label="Has video" />}
              <ChevronRight size={16} className="text-mute shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
