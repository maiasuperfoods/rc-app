import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/supabase/server";
import { AuthFrame } from "@/components/auth-frame";
import { LoginForm } from "./form";
import { setDemoRole } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const demo = isDemoMode();
  if (demo && !sp.error) {
    // In demo mode there is nothing to sign into; offer the two demo roles.
    return (
      <AuthFrame>
        <h1 className="display text-3xl leading-9 mb-2">Demo workspace</h1>
        <p className="text-sm text-dim mb-6">No store connected. Pick a seat to look around with invented data.</p>
        <form action={setDemoRole.bind(null, "coach")}><button className="btn btn-primary w-full justify-center mb-2">Enter as coach (all students)</button></form>
        <form action={setDemoRole.bind(null, "student")}><button className="btn btn-secondary w-full justify-center">Enter as a student</button></form>
      </AuthFrame>
    );
  }
  if (!demo) {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    if (data.user) redirect("/");
  }
  return (
    <AuthFrame>
      <h1 className="display text-3xl leading-9 mb-2">Sign in</h1>
      <p className="text-sm text-dim mb-6">Students use the email their coach invited. Coaches use their Renaissance OS admin login.</p>
      {sp.error && <div className="rounded-md bg-bad-dim text-bad text-sm px-3 py-2 mb-4">{sp.error}</div>}
      <LoginForm />
    </AuthFrame>
  );
}
