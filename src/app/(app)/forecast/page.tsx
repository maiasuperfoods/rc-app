import { getContext } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { defaultForecastInputs, mondayOnOrBefore } from "@/lib/calc/forecast";
import { applyActuals, buildForecastActuals } from "@/lib/calc/forecast-actuals";
import { ForecastWorkbench } from "./workbench";

export default async function ForecastPage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const today = new Date();
  const from = new Date(today.getTime() - 100 * 86400000).toISOString().slice(0, 10);
  const [saved, daily, cohorts, costs, opex, skus, inventory, suppliers, offers] = await Promise.all([
    ctx.db.forecastInputs(t.id),
    ctx.db.dailyMetrics(t.id, from),
    ctx.db.cohorts(t.id),
    ctx.db.costInputs(t.id),
    ctx.db.opex(t.id),
    ctx.db.skus(t.id),
    ctx.db.inventory(t.id),
    ctx.db.suppliers(t.id),
    ctx.db.offers(t.id),
  ]);
  const start = saved?.startDate ?? mondayOnOrBefore(today.toISOString().slice(0, 10)).toISOString().slice(0, 10);
  // Unit Economics counts as the student's own once they have set up an offer; before that the
  // cost figures are program defaults and the forecast asks for them instead of presenting them as theirs.
  const actuals = buildForecastActuals({ daily, cohorts, costs, costsAreSaved: offers.length > 0, opex, skus, inventory, suppliers, offers, modelStart: start, today });
  // A first forecast starts from the store's own numbers, not from placeholders.
  const inputs = saved ?? applyActuals(defaultForecastInputs(start), actuals, { seedTargets: true });
  return (
    <>
      <PageHeader title="Forecast" subtitle="Where your cash will be, week by week. Your store fills in how the business runs today; you tell it how much cash you have and where you want ad spend to go." />
      <ForecastWorkbench initial={inputs} isNew={!saved} tenantName={t.name} actuals={actuals} canEdit={ctx.canEdit} />
    </>
  );
}
