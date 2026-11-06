import { redirect } from "next/navigation";
import { isDemoMode, supabaseServer } from "@/lib/supabase/server";
import { AuthFrame } from "@/components/auth-frame";
import { SetPasswordForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  if (isDemoMode()) redirect("/login");
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login?error=" + encodeURIComponent("That link has expired. Ask your coach for a new one."));
  return (
    <AuthFrame>
      <h1 className="display text-2xl mb-2">Set your password</h1>
      <p className="text-sm text-dim mb-6">For <span className="text-ink">{data.user.email}</span>. You&apos;ll use it to sign in from now on.</p>
      <SetPasswordForm />
    </AuthFrame>
  );
}
