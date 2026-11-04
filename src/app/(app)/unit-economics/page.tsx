import { getContext } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { UnitEconomicsEditor } from "./editor";
import { isoDate } from "@/lib/calc/wbr";

const thirtyDaysAgo = () => isoDate(new Date(Date.now() - 30 * 86400000));

export default async function UnitEconomicsPage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const from = thirtyDaysAgo();
  const [skus, products, costs, offers, upsells, opex, daily] = await Promise.all([
    ctx.db.skus(t.id),
    ctx.db.products(t.id),
    ctx.db.costInputs(t.id),
    ctx.db.offers(t.id),
    ctx.db.upsells(t.id),
    ctx.db.opex(t.id),
    ctx.db.dailyMetrics(t.id, from),
  ]);
  const monthRevenue = daily.reduce((a, d) => a + d.revenue, 0);
  const monthSpend = daily.reduce((a, d) => a + d.adSpend, 0);
  return (
    <>
      <PageHeader title="Unit Economics & Cash Flow" subtitle="Every number here traces to an input you can see. Hover any result for its formula. The 85% rule tests landed COGS against the offer price; allowable NCPA is what is left after everything else, minus your target profit." />
      <UnitEconomicsEditor skus={skus} products={products} costs={costs} offers={offers} upsells={upsells} opex={opex} monthRevenue={monthRevenue} monthSpend={monthSpend} currency={t.currency} />
    </>
  );
}
