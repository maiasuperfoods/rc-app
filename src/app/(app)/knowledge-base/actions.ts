"use server";

import { revalidatePath } from "next/cache";
import { isDemoMode, supabaseServer } from "@/lib/supabase/server";

/** Marks a lesson complete or not for the signed-in user. No-op in demo mode (progress lives in the browser). */
export async function setLessonComplete(lessonId: string, done: boolean) {
  if (isDemoMode()) return;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  if (done) {
    await sb.from("kb_lesson_progress").upsert({ user_id: data.user.id, lesson_id: lessonId });
  } else {
    await sb.from("kb_lesson_progress").delete().eq("user_id", data.user.id).eq("lesson_id", lessonId);
  }
  revalidatePath("/knowledge-base", "layout");
}
