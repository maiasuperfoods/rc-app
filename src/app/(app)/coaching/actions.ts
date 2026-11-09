"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/data";
import { pc, pcConfigured } from "@/lib/pc/client";

/** A student can close or reopen their own commitments. Coaches use the admin desk for everything else. */
export async function setMyActionItem(id: string, status: "open" | "done"): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext({ requireTenant: true });
  if (!pcConfigured() || !ctx.tenant?.pcStudentId) return { ok: false, error: "Coaching is not connected for this brand." };
  if (!ctx.canEdit && !ctx.isCoach) return { ok: false, error: "Read-only." };
  const { data: item } = await pc().from("pc_action_items").select("id,student_id,owner").eq("id", id).maybeSingle();
  if (!item || item.student_id !== ctx.tenant.pcStudentId || item.owner !== "student") return { ok: false, error: "Not your item." };
  const { error } = await pc().from("pc_action_items").update({ status, done_at: status === "done" ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/coaching");
  return { ok: true };
}
