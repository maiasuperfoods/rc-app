import { notFound, redirect } from "next/navigation";
import { flatLessons, getKbLessonForEdit, getKbTree, kbHref } from "@/lib/kb";
import { isKbAdmin } from "@/lib/kb-admin";
import { Crumbs } from "@/components/kb/bits";
import { LessonEditor } from "@/components/kb/lesson-editor";

export const metadata = { title: "Edit lesson · Knowledge Base" };

export default async function EditLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!(await isKbAdmin())) redirect(kbHref.lesson(lessonId));
  const [t, lesson] = await Promise.all([getKbTree(true), getKbLessonForEdit(lessonId)]);
  if (!lesson) notFound();
  const here = flatLessons(t).find((l) => l.id === lesson.id);
  return (
    <>
      <Crumbs
        items={[
          { label: "Edit course", href: kbHref.admin },
          ...(here ? [{ label: here.category.title }, { label: here.chapter.title }] : []),
        ]}
      />
      <LessonEditor
        lesson={{ id: lesson.id, title: lesson.title, content: lesson.content ?? "", video: lesson.video, video_url: lesson.video_url, video_path: lesson.video_path }}
        backHref={kbHref.lesson(lesson.id)}
      />
    </>
  );
}
