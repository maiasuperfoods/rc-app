/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import Link from "next/link";
import { mediaSrc } from "@/lib/media";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { chaptersOf, getKbTree, kbHref, lessonsOf } from "@/lib/kb";
import { Crumbs, KbEmpty, KbTitle, plural } from "@/components/kb/bits";
import { DoneCount } from "@/components/kb/progress";

export default async function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const t = await getKbTree();
  if (!t.configured) return <KbEmpty />;
  const cat = t.categories.find((c) => c.id === categoryId);
  if (!cat) notFound();
  const chapters = chaptersOf(t, cat.id);

  return (
    <div className="max-w-4xl">
      <Crumbs items={[{ label: "Knowledge Base", href: kbHref.home }, { label: cat.title }]} />

      {cat.image && (
        <div className="relative aspect-[21/9] rounded-[var(--radius)] overflow-hidden border border-line mb-7 bg-bg">
          {mediaSrc("kb-media", cat.image_path) ? (
            <Image src={mediaSrc("kb-media", cat.image_path)!} alt="" fill priority quality={75} sizes="(min-width: 1024px) 900px, 100vw" className="object-cover" />
          ) : (
            <img src={cat.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)]/70 via-transparent to-transparent" />
        </div>
      )}

      <KbTitle title={cat.title} sub={plural(chapters.length, "chapter")}>
        {cat.description && <p className="text-dim mt-3 max-w-2xl">{cat.description}</p>}
      </KbTitle>

      <ol className="space-y-2.5">
        {chapters.map((ch, i) => {
          const lessons = lessonsOf(t, ch.id);
          return (
            <li key={ch.id}>
              <Link
                href={kbHref.chapter(cat.id, ch.id)}
                className="group card flex items-center gap-4 px-4 py-4 md:px-5 transition-colors hover:border-gold/40 hover:bg-hover"
              >
                <span className="h-9 w-9 shrink-0 rounded-full border border-line-strong flex items-center justify-center text-sm text-dim tabular-nums group-hover:border-gold group-hover:text-gold transition-colors">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-ink font-medium leading-snug">
                    {ch.icon && <span className="mr-2">{ch.icon}</span>}
                    {ch.title}
                  </span>
                  <span className="text-xs text-mute flex gap-2 mt-0.5">
                    {plural(lessons.length, "lesson")}
                    <DoneCount ids={lessons.map((l) => l.id)} className="text-gold" />
                  </span>
                </span>
                <ChevronRight size={18} className="text-mute shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
