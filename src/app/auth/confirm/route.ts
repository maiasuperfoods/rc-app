import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

/** Invite / reset links from a coach land here: verify the one-time token, sign in, continue to set a password. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/auth/set-password";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/auth/set-password";
  if (tokenHash && type) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("That link has expired or was already used. Ask your coach for a new one."), url.origin));
}
