import { redirect } from "next/navigation";
import { isDemoMode, supabaseServer } from "@/lib/supabase/server";
import { AuthFrame } from "@/components/auth-frame";
import { SetPasswordForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const sp = await searchParams;
  if (isDemoMode()) redirect("/login");
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login?error=" + encodeURIComponent("That link has expired. Ask your coach for a new one."));
  return (
    <AuthFrame>
      <h1 className="display text-3xl leading-9 mb-2">{sp.first ? "Choose your password" : "Set your password"}</h1>
      <p className="text-sm text-dim mb-6">For <span className="text-ink">{data.user.email}</span>. {sp.first ? "The temporary password you were given stops working once you save this one." : "You\u2019ll use it to sign in from now on."}</p>
      <SetPasswordForm />
    </AuthFrame>
  );
}
