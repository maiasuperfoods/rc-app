import { getContext } from "@/lib/data";
import { Wizard } from "./wizard";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const startNew = sp.new === "1" || !ctx.tenant;
  const t = startNew ? null : ctx.tenant;
  const [integrations, skus, offers, costs, book] = t
    ? await Promise.all([ctx.db.integrations(t.id), ctx.db.skus(t.id), ctx.db.offers(t.id), ctx.db.costInputs(t.id), ctx.db.brandBook(t.id)])
    : [[], [], [], null, null];
  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 border-b border-line flex items-center gap-3">
        <Logo className="h-7 w-7" />
        <span className="font-serif text-cream">Ren<span className="text-gold italic">ai</span>ssance <span className="text-dim text-xs tracking-[0.2em] uppercase ml-1">Commerce</span></span>
      </header>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Wizard tenant={t} integrations={integrations} skus={skus} offers={offers} costs={costs} book={book} demo={ctx.demo} />
      </div>
    </div>
  );
}
