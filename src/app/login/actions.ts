"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { adminApi } from "@/lib/admin-api";
import { getContext } from "@/lib/data";

/**
 * One form, two kinds of account:
 *  - students: Supabase Auth in the student project (created by a coach's invite)
 *  - coaches/admins: os_members in the admin project. Verified through the admin function, which then
 *    opens a session here with a one-time token (no password is ever stored in the student project).
 */
export async function signInWithPassword(_: unknown, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const sb = await supabaseServer();

  const student = await sb.auth.signInWithPassword({ email, password });
  if (!student.error) redirect("/");

  let coach: { token_hash: string; type: string; must_change: boolean } | null = null;
  let coachError: string | null = null;
  try {
    coach = await adminApi({ action: "os-login", email, password }, { anonymous: true });
  } catch (e) {
    coachError = e instanceof Error ? e.message : "Sign-in failed.";
  }
  if (!coach) {
    const wrong = /don't match|Invalid|Enter your email/i.test(coachError ?? "") || /invalid/i.test(student.error.message);
    return { error: wrong ? "That email and password don't match." : coachError ?? student.error.message };
  }
  const { error } = await sb.auth.verifyOtp({ token_hash: coach.token_hash, type: coach.type as EmailOtpType });
  if (error) return { error: "Could not open your session. Try again." };
  redirect(coach.must_change ? "/auth/set-password?first=1" : "/");
}

export async function setPassword(_: unknown, form: FormData): Promise<{ error?: string }> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: "This link has expired. Ask your coach for a new one." };
  const ctx = await getContext();
  if (ctx.isCoach) {
    // Coach passwords live in the admin project; the shadow user here keeps its random password.
    try {
      await adminApi({ action: "coach-password", password });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not save the password." };
    }
  } else {
    const { error } = await sb.auth.updateUser({ password });
    if (error) return { error: error.message };
  }
  redirect("/");
}
