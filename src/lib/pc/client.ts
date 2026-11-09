import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Private Circle coaching records (pc_* tables, pc-files bucket) live in the admin project,
 * not in the student project. Server-only access with the admin project's secret key.
 * Writes here are audited through pc_events, exactly like the original desk.
 */
let cached: SupabaseClient | null = null;

export const pcConfigured = () => Boolean(process.env.PC_SUPABASE_URL && process.env.PC_SUPABASE_SECRET_KEY);

export function pc(): SupabaseClient {
  if (!pcConfigured()) throw new Error("Coaching data is not connected (PC_SUPABASE_URL / PC_SUPABASE_SECRET_KEY).");
  if (!cached) cached = createClient(process.env.PC_SUPABASE_URL!, process.env.PC_SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export const PC_BUCKET = "pc-files";
/** Public URL of the Private Circle app (intake form, check-in form, webhooks still live there). */
export const PC_BASE = () => (process.env.PC_BASE_URL || process.env.NEXT_PUBLIC_PRIVATE_CIRCLE_URL || "https://privatecircle.renaissancecommerce.com").replace(/\/$/, "");

export async function pcLog(type: string, payload: Record<string, unknown>, studentId: string | null = null) {
  try {
    await pc().from("pc_events").insert({ type, payload, student_id: studentId });
  } catch {}
}

export async function pcSignedUrl(path: string | null | undefined, seconds = 3600) {
  if (!path) return null;
  const { data } = await pc().storage.from(PC_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
