import { getContext } from "@/lib/data";
import { Wizard } from "./wizard";
import { Logo } from "@/components/logo";
import { getTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const startNew = sp.new === "1" || !ctx.tenant;
  const t = startNew ? null : ctx.tenant;
  const [integrations, skus, offers, costs, book] = t
    ? await Promise.all([ctx.db.integrations(t.id), ctx.db.skus(t.id), ctx.db.offers(t.id), ctx.db.costInputs(t.id), ctx.db.brandBook(t.id)])
    : [[], [], [], null, null];
  const theme = await getTheme();
  if (!ctx.demo && !ctx.tenant) {
    return (
      <div className="min-h-screen grid place-items-center px-5">
        <div className="card p-8 max-w-md text-center">
          <Logo className="h-9 w-9 mx-auto mb-4" />
          <h1 className="display text-2xl">You&apos;re signed in</h1>
          <p className="text-dim text-sm mt-2">Your account isn&apos;t linked to a brand yet. Ask your coach to add you to your brand, then refresh this page.</p>
          <form action="/auth/signout" method="post" className="mt-5"><button className="btn btn-ghost justify-center w-full">Sign out</button></form>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 border-b border-line flex items-center gap-3">
        <Logo className="h-7 w-7" />
        <span className="font-serif text-cream">Ren<span className="text-gold italic">ai</span>ssance <span className="text-dim text-xs tracking-[0.2em] uppercase ml-1">Commerce</span></span>
        <div className="ml-auto"><ThemeToggle initial={theme} compact /></div>
      </header>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Wizard tenant={t} integrations={integrations} skus={skus} offers={offers} costs={costs} book={book} demo={ctx.demo} />
      </div>
    </div>
  );
}
