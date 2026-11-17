import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";

export const dynamic = "force-dynamic";
export const metadata = { title: "Continue · Renaissance Commerce", robots: { index: false } };

/** Where invite and reset links land. The token is only spent when the person presses the button. */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const sp = await searchParams;
  if (!sp.token_hash || !sp.type) redirect("/login?error=" + encodeURIComponent("That link is incomplete. Ask your coach for a new one."));
  return (
    <AuthFrame>
      <h1 className="display text-3xl leading-9 mb-2">Welcome</h1>
      <p className="text-sm text-dim mb-6">One step to go: continue to choose your password. This link works once.</p>
      <form method="post" action="/auth/confirm/go">
        <input type="hidden" name="token_hash" value={sp.token_hash} />
        <input type="hidden" name="type" value={sp.type} />
        <input type="hidden" name="next" value={sp.next ?? "/auth/set-password"} />
        <button className="btn btn-primary w-full justify-center">Continue</button>
      </form>
    </AuthFrame>
  );
}
