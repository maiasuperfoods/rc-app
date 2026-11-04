import { getContext } from "@/lib/data";
import { buildSnapshot } from "@/lib/snapshot";
import { Card, Empty, PageHeader, Pill, Stat, fmtMoney, fmtNum } from "@/components/ui";
import { SimpleBars } from "@/components/charts";
import { InventoryInputs } from "./inputs";

export default async function InventoryPage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const [s, suppliers, spendPlan, skus] = await Promise.all([buildSnapshot(ctx.db, t), ctx.db.suppliers(t.id), ctx.db.spendPlan(t.id), ctx.db.skus(t.id)]);
  const cashTied = s.forecasts.reduce((a, f) => a + f.cashTiedUp, 0);
  const soonest = [...s.forecasts].filter((f) => f.stockoutDate).sort((a, b) => a.stockoutDate!.localeCompare(b.stockoutDate!))[0];

  return (
    <>
      <PageHeader title="Inventory Planning & Forecast" subtitle="Demand is last-30-day sales from Shopify, scaled by your ad-spend plan. Reorder date = stock-out date − supplier lead time − 14 days of safety. The suggested PO covers lead time plus 90 days." />

      {s.forecasts.length === 0 ? (
        <Empty title="No stock levels yet" body="Inventory levels come from Shopify after the first sync. Add supplier lead times and your spend plan below so the forecast is ready the moment stock arrives." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Cash tied up in stock" value={fmtMoney(cashTied)} formula="on hand × landed cost" />
            <Stat label="Next stock-out" value={soonest ? soonest.stockoutDate! : "90+ days"} tone={soonest?.reorderStatus === "overdue" ? "bad" : soonest?.reorderStatus === "soon" ? "warn" : "good"} hint={soonest?.variantTitle} />
            <Stat label="Spend plan vs now" value={`${s.forecasts[0]?.spendMultiplier.toFixed(2)}×`} hint="demand multiplier applied" />
            <Stat label="SKUs to reorder" value={s.forecasts.filter((f) => f.reorderStatus === "soon" || f.reorderStatus === "overdue").length} tone={s.forecasts.some((f) => f.reorderStatus === "overdue") ? "bad" : "neutral"} />
          </div>

          <Card title="Reorder plan" className="mb-5">
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>SKU</th><th className="num">On hand</th><th className="num">Inbound</th><th className="num">Units/day</th><th className="num">Days of cover</th><th>Stock-out</th><th>Reorder by</th><th className="num">Lead time</th><th className="num">Suggested PO</th><th>Status</th></tr></thead>
                <tbody>
                  {s.forecasts.map((f) => (
                    <tr key={f.skuId}>
                      <td><div>{f.variantTitle}</div><div className="text-xs text-mute">{f.skuCode}</div></td>
                      <td className="num">{fmtNum(f.onHand)}</td>
                      <td className="num">{fmtNum(f.inboundTotal)}</td>
                      <td className="num">{f.dailyVelocity.toFixed(1)} <span className="text-mute text-xs">({f.baseVelocity.toFixed(0)} now)</span></td>
                      <td className="num">{f.daysOfCover ?? "—"}</td>
                      <td>{f.stockoutDate ?? "beyond horizon"}</td>
                      <td>{f.reorderByDate ?? "—"}</td>
                      <td className="num">{f.leadTimeDays} d</td>
                      <td className="num font-medium">{f.suggestedPoQty ? fmtNum(f.suggestedPoQty) : "—"}{f.moq && f.suggestedPoQty === f.moq ? <span className="text-mute text-xs"> (MOQ)</span> : null}</td>
                      <td><Pill tone={f.reorderStatus === "overdue" ? "bad" : f.reorderStatus === "soon" ? "warn" : f.reorderStatus === "ok" ? "good" : "mute"}>{f.reorderStatus === "overdue" ? "Order now" : f.reorderStatus === "soon" ? "Order soon" : f.reorderStatus === "ok" ? "Covered" : "No sales data"}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            {s.forecasts.slice(0, 4).map((f) => (
              <Card key={f.skuId} title={`${f.variantTitle} — projected stock by week`}>
                <SimpleBars data={f.weekly} x="week" y="endingOnHand" label="Units on hand" />
              </Card>
            ))}
          </div>
        </>
      )}

      <InventoryInputs suppliers={suppliers} spendPlan={spendPlan} skus={skus} currentMonthlySpend={s.monthSpend} />
    </>
  );
}
