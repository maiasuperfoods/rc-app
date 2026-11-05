import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { LoginForm } from "./form";
import { setDemoRole } from "@/app/actions";
import { getTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const sp = await searchParams;
  const demo = isDemoMode();
  if (demo && !sp.error) {
    // In demo mode there is nothing to sign into; offer the two demo roles.
    return (
      <Frame>
        <h1 className="display text-2xl mb-2">Demo workspace</h1>
        <p className="text-sm text-dim mb-6">No store connected. Pick a seat to look around with invented data.</p>
        <form action={setDemoRole.bind(null, "coach")}><button className="btn btn-primary w-full justify-center mb-2">Enter as coach (all students)</button></form>
        <form action={setDemoRole.bind(null, "student")}><button className="btn btn-secondary w-full justify-center">Enter as a student</button></form>
      </Frame>
    );
  }
  if (!demo) {
    // Already signed in → home
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    if (data.user) redirect("/");
  }
  return (
    <Frame>
      <h1 className="display text-2xl mb-2">Sign in</h1>
      <p className="text-sm text-dim mb-6">Use the same email as your Private Circle account. We&apos;ll send a one-time link.</p>
      {sp.error && <div className="rounded-md bg-bad-dim text-bad text-sm px-3 py-2 mb-4">{sp.error}</div>}
      {sp.sent ? <div className="rounded-md bg-good-dim text-good text-sm px-3 py-2">Check your inbox for the sign-in link.</div> : <LoginForm />}
    </Frame>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  return (
    <div className="min-h-screen grid place-items-center px-5 relative">
      <div className="absolute top-4 right-4"><ThemeToggle initial={theme} compact /></div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Logo className="h-9 w-9" />
          <div className="font-serif text-cream text-lg">Ren<span className="text-gold italic">ai</span>ssance <span className="text-dim text-xs tracking-[0.2em] uppercase">Commerce</span></div>
        </div>
        <div className="card p-6">{children}</div>
        <p className="text-center text-xs text-mute mt-6">app.renaissancecommerce.com</p>
      </div>
    </div>
  );
}
