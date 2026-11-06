import { cache } from "react";
import { isDemoMode, supabaseServer } from "@/lib/supabase/server";
import { getGuide, renderGuide } from "@/lib/video-ads";

/**
 * Knowledge Base (the Renaissance Commerce course) — data access.
 *
 * Live mode: reads kb_* tables with the signed-in user's session (RLS: authenticated read)
 * and signs media from the private `kb-media` bucket.
 * Demo mode (no Supabase session): reads through the `kb` edge function using
 * KB_API_URL + KB_API_TOKEN (server-only env), which returns the same shapes.
 */

/** True on the standalone Knowledge Base deployment (e.g. rc-knowledge-base.vercel.app). */
export const isKbStandalone = () => process.env.KB_STANDALONE === "true";

export interface KbCategory { id: string; title: string; description: string; image: string | null; image_path?: string | null; order: number }
export interface KbChapter { id: string; category_id: string; title: string; icon: string | null; order: number }
export interface KbLessonRef { id: string; chapter_id: string; title: string; order: number; has_video: boolean }
export interface KbLesson { id: string; chapter_id: string; title: string; content: string; video: string | null; order: number }

export interface KbTree {
  categories: KbCategory[];
  chapters: KbChapter[];
  lessons: KbLessonRef[];
  configured: boolean;
}

const SIGN_TTL = 60 * 60 * 6;
const EMPTY: KbTree = { categories: [], chapters: [], lessons: [], configured: false };

async function edge<T>(qs: string): Promise<T | null> {
  const url = process.env.KB_API_URL;
  const token = process.env.KB_API_TOKEN;
  if (!url || !token) return null;
  const r = await fetch(`${url}?${qs}`, { headers: { "x-kb-token": token }, next: { revalidate: 300 } });
  if (!r.ok) return null;
  return (await r.json()) as T;
}

/** Course content lives in the content project; the student project only stores progress. */
const contentViaEdge = () => isDemoMode() || Boolean(process.env.KB_API_URL);

export const getKbTree = cache(async (): Promise<KbTree> => {
  if (contentViaEdge()) {
    const t = await edge<Omit<KbTree, "configured">>("view=tree");
    return t ? { ...t, configured: true } : EMPTY;
  }
  const sb = await supabaseServer();
  const [cats, chs, les] = await Promise.all([
    sb.from("kb_categories").select("id,title,description,image_url,image_path,order").order("order"),
    sb.from("kb_chapters").select("id,category_id,title,icon,order").order("order"),
    sb.from("kb_lessons").select("id,chapter_id,title,order,video_url").order("order"),
  ]);
  const categories = await Promise.all(
    (cats.data ?? []).map(async (c) => {
      let image: string | null = c.image_url;
      if (c.image_path) {
        const { data } = await sb.storage.from("kb-media").createSignedUrl(c.image_path, SIGN_TTL);
        image = data?.signedUrl ?? image;
      }
      return { id: c.id, title: c.title, description: c.description ?? "", image, image_path: c.image_path, order: c.order };
    }),
  );
  const lessons = (les.data ?? []).map((l) => ({ id: l.id, chapter_id: l.chapter_id, title: l.title, order: l.order, has_video: Boolean(l.video_url) }));
  return { categories, chapters: chs.data ?? [], lessons, configured: true };
});

/**
 * Some lessons are written in the repo as Markdown guides (src/content). Their row in kb_lessons holds
 * only a marker, `<!--rc-guide:slug-->`, which is swapped for the rendered guide here.
 */
function withGuide(l: KbLesson | null): KbLesson | null {
  const m = l?.content.trim().match(/^<!--rc-guide:([a-z0-9-]+)-->$/);
  if (!l || !m) return l;
  const g = getGuide(m[1]);
  return g ? { ...l, content: `<div class="kb-guide">${renderGuide(g.md).html}</div>` } : l;
}

export const getKbLesson = cache(async (id: string): Promise<KbLesson | null> => withGuide(await getKbLessonRaw(id)));

const getKbLessonRaw = async (id: string): Promise<KbLesson | null> => {
  if (contentViaEdge()) return edge<KbLesson>(`view=lesson&id=${encodeURIComponent(id)}`);
  const sb = await supabaseServer();
  const { data: l } = await sb.from("kb_lessons").select("id,chapter_id,title,content,video_url,video_path,order").eq("id", id).maybeSingle();
  if (!l) return null;
  let video: string | null = l.video_url;
  if (l.video_path) {
    const { data } = await sb.storage.from("kb-media").createSignedUrl(l.video_path, SIGN_TTL);
    video = data?.signedUrl ?? video;
  }
  return { id: l.id, chapter_id: l.chapter_id, title: l.title, content: l.content ?? "", video, order: l.order };
};

/** Lessons the signed-in user has completed. Demo mode tracks progress in the browser instead. */
export async function getKbProgress(): Promise<string[]> {
  if (isDemoMode()) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from("kb_lesson_progress").select("lesson_id");
  return (data ?? []).map((r) => r.lesson_id);
}

// ---- tree helpers ----

export const chaptersOf = (t: KbTree, categoryId: string) => t.chapters.filter((c) => c.category_id === categoryId);
export const lessonsOf = (t: KbTree, chapterId: string) => t.lessons.filter((l) => l.chapter_id === chapterId);

export function categoryStats(t: KbTree, categoryId: string) {
  const chs = chaptersOf(t, categoryId);
  return { chapters: chs.length, lessons: chs.reduce((n, c) => n + lessonsOf(t, c.id).length, 0) };
}

/** All lessons in course order (category → chapter → lesson), for prev/next. */
export function flatLessons(t: KbTree) {
  return t.categories.flatMap((cat) => chaptersOf(t, cat.id).flatMap((ch) => lessonsOf(t, ch.id).map((l) => ({ ...l, chapter: ch, category: cat }))));
}

/** Compact tree for the sidebar dropdowns (titles and ids only). */
export type KbNavTree = { id: string; title: string; chapters: { id: string; title: string; icon: string | null; lessons: { id: string; title: string }[] }[] }[];
export function navTree(t: KbTree): KbNavTree {
  return t.categories.map((cat) => ({
    id: cat.id,
    title: cat.title,
    chapters: chaptersOf(t, cat.id).map((ch) => ({ id: ch.id, title: ch.title, icon: ch.icon, lessons: lessonsOf(t, ch.id).map((l) => ({ id: l.id, title: l.title })) })),
  }));
}

export const kbHref = {
  home: "/knowledge-base",
  category: (catId: string) => `/knowledge-base/${catId}`,
  chapter: (catId: string, chId: string) => `/knowledge-base/${catId}/${chId}`,
  lesson: (lessonId: string) => `/knowledge-base/lesson/${lessonId}`,
};
