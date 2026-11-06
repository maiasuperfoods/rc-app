import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/supabase/server";
import { AuthFrame } from "@/components/auth-frame";
import { SetupForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "First-time setup · Renaissance Commerce" };

/** Creates the first coach account, once, with the one-time setup code. After that it only points to sign-in. */
export default function SetupPage() {
  if (isDemoMode()) redirect("/login");
  return (
    <AuthFrame>
      <h1 className="display text-2xl mb-2">First-time setup</h1>
      <p className="text-sm text-dim mb-6">Create the first coach account. You&apos;ll need the one-time setup code. Once used, this page closes and new people join by invite.</p>
      <SetupForm />
    </AuthFrame>
  );
}
