import { getContext } from "@/lib/data";
import { Empty, PageHeader } from "@/components/ui";
import { DEFAULT_CREATIVE_RULES } from "@/lib/types";
import { isoDate } from "@/lib/calc/wbr";
import { CreativeDashboard } from "./dashboard";

const ninetyDaysAgo = () => isoDate(new Date(Date.now() - 89 * 86400000));

export default async function CreativePage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const from = ninetyDaysAgo();
  const [rows, book, tasks, daily, integrations] = await Promise.all([ctx.db.adInsights(t.id, from), ctx.db.brandBook(t.id), ctx.db.creativeTasks(t.id), ctx.db.dailyMetrics(t.id, from), ctx.db.integrations(t.id)]);
  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Creative" />
        <Empty title="No ads synced yet" body="Connect your Meta ad account and Triple Whale, and name your ads with the convention in the Brand Book. Every ad then lands here with new-customer ROAS, its strategist, angle, awareness level and ad type." action={{ href: "/integrations", label: "Connect Meta" }} />
      </>
    );
  }
  const hasPixel = integrations.some((i) => i.provider === "triple_whale" && i.connected) || rows.some((r) => r.ncPurchases > 0);
  return (
    <CreativeDashboard
      brandName={t.name}
      rows={rows}
      tasks={tasks}
      daily={daily.map((d) => ({ date: d.date, revenue: d.revenue, adSpend: d.adSpend, newCustomers: d.newCustomers }))}
      convention={book.adNamingConvention}
      strategists={Object.fromEntries((book.strategists ?? []).map((s) => [s.code, s.name]))}
      rules={book.creativeRules ?? DEFAULT_CREATIVE_RULES}
      hasPixel={hasPixel}
      timezone={t.timezone}
      canEditRules
    />
  );
}
