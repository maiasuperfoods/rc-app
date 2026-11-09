import { dueForProvisioning, provisionStudent } from "@/lib/pc/provision";
import { pcConfigured } from "@/lib/pc/client";

/** Creates platform brands for students who have paid and completed the intake since the last run. */
export async function runProvisioning() {
  if (!pcConfigured()) return { skipped: "coaching not connected" };
  const due = await dueForProvisioning();
  const results: { email: string; ok: boolean; error?: string }[] = [];
  for (const s of due) {
    try { const r = await provisionStudent(s.id); results.push({ email: s.email, ok: Boolean(r.tenantId) }); }
    catch (e) { results.push({ email: s.email, ok: false, error: (e as Error).message }); }
  }
  return { due: due.length, results };
}
