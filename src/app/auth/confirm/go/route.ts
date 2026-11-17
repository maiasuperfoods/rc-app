import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Spends the one-time token from an invite or reset link, signs the person in, and continues to
 * set a password. POST only: the link in the email opens /auth/confirm, which shows a button, so
 * a mail scanner that opens links cannot use the token up before the person does.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const form = await req.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;
  const next = String(form.get("next") ?? "/auth/set-password");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/auth/set-password";
  if (tokenHash && type) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin), 303);
  }
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("That link has expired or was already used. Ask your coach for a new one."), url.origin), 303);
}
