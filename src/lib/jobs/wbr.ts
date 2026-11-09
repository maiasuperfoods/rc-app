/**
 * Monday job: builds and stores the Weekly Business Review for every active
 * tenant, then emails it (Resend) if RESEND_API_KEY is set. Runs from /api/cron/wbr.
 */
import { supabaseAdmin } from "@/lib/supabase/server";
import { SupabaseSource } from "@/lib/data/supabase";
import { buildSnapshot } from "@/lib/snapshot";
import { generateCommentary } from "@/lib/llm";

/** Builds, stores and emails the Weekly Business Review for every brand with data. */
export async function runWbr() {
  let done = 0, failed = 0;
  const admin = supabaseAdmin();
  const db = new SupabaseSource(admin);
  const tenants = await db.tenants("all");
  for (const t of tenants) {
    try {
      const s = await buildSnapshot(db, t);
      if (!s.daily.length) continue;
      const commentary = await generateCommentary({ tenant: t, brandBook: s.brandBook, metrics: s.week.metrics, previous: s.week.previous, allowableNcpa: s.ue.blended?.allowableCac ?? null, flags: s.flags, fallback: s.commentary });
      await db.saveWbrReport({ id: "", tenantId: t.id, weekStart: s.week.start, weekEnd: s.week.end, metrics: s.week.metrics, previous: s.week.previous, commentary, generatedAt: new Date().toISOString(), coachAnnotation: null });
      await email(admin, t.id, t.name, s.week.start, commentary);
      done++;
    } catch (e) {
      failed++;
      console.error(`[wbr] ${t.name} failed`, e);
    }
  }
  return { done, failed };
}

async function email(admin: ReturnType<typeof supabaseAdmin>, tenantId: string, name: string, weekStart: string, commentary: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const { data: members } = await admin.from("tenant_members").select("user_id").eq("tenant_id", tenantId);
  const emails: string[] = [];
  for (const m of members ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    if (data.user?.email) emails.push(data.user.email);
  }
  if (!emails.length) return;
  const url = `${process.env.APP_URL ?? "https://app.renaissancecommerce.com"}/wbr`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Renaissance Commerce <reviews@renaissancecommerce.com>",
      to: emails,
      subject: `${name} — weekly review for ${weekStart}`,
      text: `${commentary}\n\nOpen the full review: ${url}`,
    }),
  });
}

