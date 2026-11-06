import { isDemoMode } from "@/lib/supabase/server";
import { isResourcesAdmin } from "@/lib/resources";

/**
 * Who may edit the course: anyone who unlocked admin with the admin password (both sites),
 * or a signed-in coach on the live app.
 */
export async function isKbAdmin() {
  if (await isResourcesAdmin()) return true;
  if (isDemoMode()) return false;
  try {
    const { getDataSource } = await import("@/lib/data");
    const db = await getDataSource();
    const user = await db.currentUser();
    return user ? await db.isCoach(user.id) : false;
  } catch {
    return false;
  }
}

/** Server-only course write. Callers must check isKbAdmin() first. */
export async function kbPost<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const url = process.env.KB_API_URL;
  const token = process.env.KB_API_TOKEN;
  if (!url || !token) throw new Error("The course API is not configured (KB_API_URL / KB_API_TOKEN).");
  const r = await fetch(url, { method: "POST", headers: { "x-kb-token": token, "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${r.status})`);
  return json as T;
}
