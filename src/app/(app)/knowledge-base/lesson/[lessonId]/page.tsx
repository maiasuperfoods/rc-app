import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { flatLessons, getKbLesson, getKbTree, kbHref } from "@/lib/kb";
import { Crumbs, KbEmpty } from "@/components/kb/bits";
import { CompleteButton } from "@/components/kb/progress";
import { PromptCopy } from "@/components/kb/prompt-copy";
import { Pencil } from "lucide-react";
import { VideoPlayer } from "@/components/kb/video-player";
import { VideoSlot } from "@/components/kb/video-slot";
import { isKbAdmin } from "@/lib/kb-admin";

/** Course HTML comes from our own kb_lessons table. Open outbound links in a new tab. */
function prepare(html: string) {
  return html.replace(/<a (?![^>]*target=)/g, '<a target="_blank" rel="noopener noreferrer" ').replace(/<h2><\/h2>/g, "");
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const [t, lesson, admin] = await Promise.all([getKbTree(), getKbLesson(lessonId), isKbAdmin()]);
  if (!t.configured) return <KbEmpty />;
  if (!lesson) notFound();

  const all = flatLessons(t);
  const idx = all.findIndex((l) => l.id === lesson.id);
  const here = all[idx];
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const pos = here ? all.filter((l) => l.chapter_id === here.chapter_id) : [];
  const n = pos.findIndex((l) => l.id === lesson.id) + 1;

  return (
    <article className="max-w-[860px]">
      {here && (
        <Crumbs
          items={[
            { label: "Knowledge Base", href: kbHref.home },
            { label: here.category.title, href: kbHref.category(here.category.id) },
            { label: here.chapter.title, href: kbHref.chapter(here.category.id, here.chapter.id) },
          ]}
        />
      )}

      <header className="mb-6">
        {n > 0 && <div className="label mb-2">Lesson {n} of {pos.length}</div>}
        <div className="flex items-start justify-between gap-4">
          <h1 className="display text-[1.9rem] md:text-[2.5rem] leading-[1.12]">{lesson.title}</h1>
          {admin && <Link href={kbHref.edit(lesson.id)} className="btn btn-primary !py-1.5 !text-xs shrink-0 mt-2"><Pencil size={13} /> Edit lesson</Link>}
        </div>
      </header>

      {lesson.video && (
        <div className="mb-8 rounded-[var(--radius)] overflow-hidden border border-line bg-black shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
          <VideoPlayer key={lesson.id} src={lesson.video} title={lesson.title} />
        </div>
      )}
      {admin && <VideoSlot lessonId={lesson.id} hasVideo={Boolean(lesson.video)} />}

      {lesson.content.trim() && (
        <div className="kb-prose card px-6 py-7 md:px-10 md:py-9" dangerouslySetInnerHTML={{ __html: prepare(lesson.content) }} />
      )}
      {lesson.content.includes("kb-prompt") && <PromptCopy lessonId={lesson.id} />}

      <div className="mt-8 flex flex-wrap items-center gap-3 justify-between border-t border-line pt-6">
        <div className="flex gap-2">
          {prev && (
            <Link href={kbHref.lesson(prev.id)} className="btn btn-ghost max-w-[18rem]" title={prev.title}>
              <ArrowLeft size={15} />
              <span className="truncate">{prev.title}</span>
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          <CompleteButton id={lesson.id} nextHref={next ? kbHref.lesson(next.id) : undefined} />
          {next && (
            <Link href={kbHref.lesson(next.id)} className="btn btn-secondary max-w-[18rem]" title={next.title}>
              <span className="truncate">Next</span>
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
