import { getContext } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { defaultForecastInputs, mondayOnOrBefore } from "@/lib/calc/forecast";
import { ForecastWorkbench } from "./workbench";

export default async function ForecastPage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const saved = await ctx.db.forecastInputs(t.id);
  const inputs = saved ?? defaultForecastInputs(mondayOnOrBefore(new Date().toISOString().slice(0, 10)).toISOString().slice(0, 10));
  return (
    <>
      <PageHeader title="Forecast" subtitle="The cash-flow model as a working tool: a weekly engine from ad-spend ramp to closing cash, with 28-day rebill cohorts, inventory POs, the card float and the PayPal reserve. Change an input and every tab recalculates." />
      <ForecastWorkbench initial={inputs} isNew={!saved} tenantName={t.name} />
    </>
  );
}
