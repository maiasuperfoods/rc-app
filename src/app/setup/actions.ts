"use server";

import { redirect } from "next/navigation";
import { adminApi } from "@/lib/admin-api";
import { supabaseServer } from "@/lib/supabase/server";

export async function bootstrapCoach(_: unknown, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  try {
    await adminApi({ action: "bootstrap", code: form.get("code"), name: form.get("name"), email, password }, { anonymous: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Setup failed." };
  }
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: "Account created, but signing in failed. Go to the sign-in page." };
  redirect("/admin/access");
}
