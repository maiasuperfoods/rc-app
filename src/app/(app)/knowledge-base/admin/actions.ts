"use server";

import { revalidatePath, updateTag } from "next/cache";
import { isKbAdmin, kbPost } from "@/lib/kb-admin";

type Kind = "category" | "chapter" | "lesson";
type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    if (!(await isKbAdmin())) throw new Error("Admin access required. Unlock admin first.");
    const data = await fn();
    updateTag("kb");
    revalidatePath("/knowledge-base", "layout");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function kbCreate(kind: Kind, parentId: string | null, title?: string) {
  return run(() => kbPost<{ id: string }>({ action: "create", kind, parent_id: parentId, title }));
}

export async function kbUpdate(kind: Kind, id: string, patch: Record<string, unknown>) {
  return run(() => kbPost({ action: "update", kind, id, patch }));
}

export async function kbDelete(kind: Kind, id: string) {
  return run(() => kbPost({ action: "delete", kind, id }));
}

export async function kbReorder(kind: Kind, ids: string[]) {
  return run(() => kbPost({ action: "reorder", kind, ids }));
}

export async function kbMove(kind: "chapter" | "lesson", id: string, parentId: string) {
  return run(() => kbPost({ action: "move", kind, id, parent_id: parentId }));
}

/** A one-time direct upload URL into the course bucket (videos, category art, images inside lessons). */
export async function kbUploadUrl(purpose: "video" | "category" | "lesson-image", filename: string) {
  return run(() => kbPost<{ path: string; signedUrl: string }>({ action: "upload-url", purpose, filename }));
}
