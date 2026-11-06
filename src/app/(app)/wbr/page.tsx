import { getContext } from "@/lib/data";
import { buildSnapshot } from "@/lib/snapshot";
import { Card, Empty, PageHeader, Pill, Stat, fmtMoney, fmtPct, fmtX } from "@/components/ui";
import { SimpleLine } from "@/components/charts";
import { pctChange } from "@/lib/calc/wbr";
import { generateCommentary } from "@/lib/llm";
import Link from "next/link";
import { defaultForecastInputs, mondayOnOrBefore, runForecast } from "@/lib/calc/forecast";
import { PacingView } from "./pacing";

function WbrTabs({ tab }: { tab: "week" | "pacing" }) {
  const item = (k: "week" | "pacing", label: string) => (
    <Link href={k === "week" ? "/wbr" : "/wbr?tab=pacing"} className={`px-3 py-2 -mb-px border-b-2 text-sm ${tab === k ? "border-gold text-ink font-medium" : "border-transparent text-dim hover:text-ink"}`}>{label}</Link>
  );
  return <nav className="flex gap-1 border-b border-line mb-5" aria-label="Sections">{item("week", "This week")}{item("pacing", "Pacing")}</nav>;
}

export default async function WbrPage({ searchParams }: { searchParams: Promise<{ tab?: string; w?: string }> }) {
  const { tab, w } = await searchParams;
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const s = await buildSnapshot(ctx.db, t);

  if (tab === "pacing") {
    const saved = await ctx.db.forecastInputs(t.id);
    const starter = !saved && ctx.demo;
    const eightWeeksAgo = shift(s.week.end, -55);
    const inputs = saved ?? defaultForecastInputs(mondayOnOrBefore(eightWeeksAgo).toISOString().slice(0, 10));
    return (
      <>
        <PageHeader title="Weekly Business Review" subtitle="Pacing: how each week is landing against the plan in your Forecast, above or below target." />
        <WbrTabs tab="pacing" />
        <PacingView res={runForecast(inputs)} daily={s.daily} weekParam={w} hasPlan={Boolean(saved) || starter} starter={starter} />
      </>
    );
  }

  if (s.daily.length === 0) {
    return (
      <>
        <PageHeader title="Weekly Business Review" />
        <WbrTabs tab="week" />
        <Empty title="No weeks to review yet" body="Once Shopify and Triple Whale are connected, every Monday you get one page: the numbers, the deltas, and what to do about them." action={{ href: "/integrations", label: "Connect data" }} />
      </>
    );
  }
  const m = s.week.metrics;
  const p = s.week.previous;
  const allowable = s.ue.blended?.allowableCac ?? null;
  const commentary = await generateCommentary({ tenant: t, brandBook: s.brandBook, metrics: m, previous: p, allowableNcpa: allowable, flags: s.flags, fallback: s.commentary });
  const saved = await ctx.db.wbrReports(t.id, 1);
  const annotation = saved[0]?.weekStart === s.week.start ? saved[0].coachAnnotation : null;

  // weekly series for the trend charts (last 12 complete weeks)
  const weeks: { week: string; revenue: number; ncpa: number; roas: number; cm: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const end = shift(s.week.end, -7 * i);
    const start = shift(end, -6);
    const rows = s.daily.filter((d) => d.date >= start && d.date <= end);
    if (!rows.length) continue;
    const rev = rows.reduce((a, d) => a + d.revenue, 0);
    const sp = rows.reduce((a, d) => a + d.adSpend, 0);
    const nc = rows.reduce((a, d) => a + d.newCustomers, 0);
    const cogs = rows.reduce((a, d) => a + d.cogs, 0);
    const ref = rows.reduce((a, d) => a + d.refunds, 0);
    weeks.push({ week: start, revenue: rev, ncpa: nc ? sp / nc : 0, roas: sp ? rev / sp : 0, cm: rev - cogs - ref - sp });
  }

  const latestCohort = s.cohorts[s.cohorts.length - 1];
  const cs = s.support.filter((x) => x.date >= s.week.start && x.date <= s.week.end);
  const frt = cs.length ? cs.reduce((a, x) => a + x.firstResponseMinutes, 0) / cs.length : null;
  const reasons = new Map<string, number>();
  for (const d of cs) for (const r of d.topReasons) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + r.count);

  return (
    <>
      <PageHeader title="Weekly Business Review" subtitle={`Week of ${s.week.start} to ${s.week.end}, compared with ${s.week.prevStart} to ${s.week.prevEnd}. Business truth from Triple Whale; creative diagnostics live on the Creative page.`} />
      <WbrTabs tab="week" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Revenue" value={fmtMoney(m.revenue)} delta={pctChange(m.revenue, p.revenue)} />
        <Stat label="Orders · AOV" value={<span>{m.orders.toLocaleString()} <span className="text-dim text-base">· {fmtMoney(m.aov)}</span></span>} delta={pctChange(m.aov, p.aov)} />
        <Stat label="Ad spend · ROAS" value={<span>{fmtMoney(m.adSpend)} <span className="text-dim text-base">· {fmtX(m.blendedRoas)}</span></span>} delta={pctChange(m.blendedRoas, p.blendedRoas)} />
        <Stat label="New customers · NCPA" value={<span>{m.newCustomers.toLocaleString()} <span className={`text-base ${allowable != null && m.ncpa > allowable ? "text-bad" : "text-good"}`}>· {fmtMoney(m.ncpa)}</span></span>} delta={pctChange(m.ncpa, p.ncpa)} lowerIsBetter hint={allowable != null ? `allowable ${fmtMoney(allowable)}` : undefined} />
        <Stat label="Contribution margin" value={fmtMoney(m.contributionMargin)} delta={pctChange(m.contributionMargin, p.contributionMargin)} hint={`${fmtPct(m.contributionMarginPct)} of revenue`} formula="revenue − COGS − fulfillment − processing − refunds − ad spend" />
        <Stat label="Refund rate" value={fmtPct(m.refundRate, 1)} tone={m.refundRate > 0.05 ? "bad" : "neutral"} />
        <Stat label="Repurchase (latest cohort)" value={latestCohort ? fmtPct(latestCohort.repurchaseRate) : "—"} hint={latestCohort ? `LTV 90d ${fmtMoney(latestCohort.ltv90)} · cohort ${latestCohort.cohortMonth}` : "connect Lifetimely"} />
        <Stat label="Tickets / 100 orders" value={m.ticketsPerHundredOrders == null ? "—" : m.ticketsPerHundredOrders.toFixed(1)} hint={frt != null ? `first response ${Math.round(frt)} min` : "connect Commslayer"} tone={m.ticketsPerHundredOrders != null && m.ticketsPerHundredOrders > 10 ? "warn" : "neutral"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <Card title="Commentary" hint="Written from this week's numbers and your Brand Book. Never a number that isn't above." className="lg:col-span-2">
          <div className="space-y-3 text-sm text-ink leading-relaxed">
            {commentary.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}
          </div>
          {annotation && (
            <div className="mt-4 border-l-2 border-gold pl-3">
              <div className="label mb-1">Coach note</div>
              <p className="text-sm text-dim">{annotation}</p>
            </div>
          )}
        </Card>
        <Card title="Flags" hint="Thresholds come from the course and from your Unit Economics">
          {s.flags.length === 0 ? <p className="text-sm text-good">Clean week.</p> : (
            <ul className="space-y-2">
              {s.flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Pill tone={f.severity === "red" ? "bad" : "warn"}>{f.severity}</Pill>
                  <span className="text-dim">{f.message}</span>
                </li>
              ))}
            </ul>
          )}
          {reasons.size > 0 && (
            <>
              <div className="label mt-5 mb-2">Why customers wrote in</div>
              <ul className="text-sm space-y-1">
                {[...reasons].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, c]) => <li key={r} className="flex justify-between"><span className="text-dim">{r}</span><span className="tabular-nums">{c}</span></li>)}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Card title="Revenue by week"><SimpleLine data={weeks} x="week" y="revenue" label="Revenue" /></Card>
        <Card title="NCPA by week" hint={allowable != null ? `allowable ${fmtMoney(allowable)}` : undefined}><SimpleLine data={weeks} x="week" y="ncpa" label="NCPA" color="info" /></Card>
        <Card title="Blended ROAS by week"><SimpleLine data={weeks} x="week" y="roas" label="ROAS" format="x" color="good" /></Card>
        <Card title="Contribution after ads by week"><SimpleLine data={weeks} x="week" y="cm" label="Contribution" color="gold" /></Card>
      </div>

      {s.cohorts.length > 0 && (
        <Card title="LTV cohorts" hint="From Lifetimely when connected, otherwise computed from Shopify orders.">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Cohort</th><th className="num">Customers</th><th className="num">LTV 30d</th><th className="num">60d</th><th className="num">90d</th><th className="num">180d</th><th className="num">Repurchase</th></tr></thead>
              <tbody>
                {s.cohorts.map((c) => (
                  <tr key={c.cohortMonth}><td>{c.cohortMonth}</td><td className="num">{c.customers.toLocaleString()}</td><td className="num">{fmtMoney(c.ltv30)}</td><td className="num">{fmtMoney(c.ltv60)}</td><td className="num">{fmtMoney(c.ltv90)}</td><td className="num">{fmtMoney(c.ltv180)}</td><td className="num">{fmtPct(c.repurchaseRate)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function shift(s: string, n: number) {
  const d = new Date(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
