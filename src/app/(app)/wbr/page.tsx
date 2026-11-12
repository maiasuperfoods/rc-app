import { getContext } from "@/lib/data";
import { buildSnapshot } from "@/lib/snapshot";
import { Card, Empty, PageHeader, Pill, fmtMoney, fmtPct } from "@/components/ui";
import { SimpleLine } from "@/components/charts";
import { generateCommentary } from "@/lib/llm";
import Link from "next/link";
import { defaultForecastInputs, mondayOnOrBefore, runForecast } from "@/lib/calc/forecast";
import { PacingView } from "./pacing";
import { KPIS, SCORE_GROUPS, buildScorecard, deltaTone, fmtKpi, targetToDisplay, type ScoreRow, type ScoreStatus } from "@/lib/calc/scorecard";
import { Board, NoteInput, OwnerInput, RunOfShow, TargetInput } from "./review-client";

type TabKey = "week" | "pacing" | "board" | "agenda" | "definitions";
const TAB_LIST: [TabKey, string][] = [["week", "This week"], ["pacing", "Pacing"], ["board", "Board"], ["agenda", "Run of show"], ["definitions", "Definitions"]];

function WbrTabs({ tab, openItems = 0 }: { tab: TabKey; openItems?: number }) {
  return (
    <nav className="flex gap-1 border-b border-line mb-5 overflow-x-auto" aria-label="Sections">
      {TAB_LIST.map(([k, label]) => (
        <Link key={k} href={k === "week" ? "/wbr" : `/wbr?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`shrink-0 px-3 py-2 -mb-px border-b-2 text-sm ${tab === k ? "border-gold text-ink font-medium" : "border-transparent text-dim hover:text-ink"}`}>
          {label}{k === "board" && openItems > 0 && <span className="ml-1.5 text-xs tabular-nums text-mute">{openItems}</span>}
        </Link>
      ))}
    </nav>
  );
}

const CHIP: Record<ScoreStatus, { tone: "good" | "warn" | "bad" | "mute"; label: string }> = {
  ok: { tone: "good", label: "on target" },
  near: { tone: "warn", label: "near" },
  miss: { tone: "bad", label: "missed" },
  watch: { tone: "warn", label: "watch" },
  none: { tone: "mute", label: "no target" },
  nodata: { tone: "mute", label: "no data" },
};

/** Eight weeks in a line. The last point is this week. */
function Spark({ values, tone }: { values: (number | null)[]; tone: "good" | "bad" | "flat" }) {
  const pts = values.slice(-9).map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 3) return <span className="text-mute">—</span>;
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const n = Math.max(1, values.slice(-9).length - 1);
  const xy = (p: { v: number; i: number }) => `${((p.i / n) * 76 + 2).toFixed(1)},${(hi === lo ? 10 : 18 - ((p.v - lo) / (hi - lo)) * 16).toFixed(1)}`;
  const last = pts[pts.length - 1];
  const dot = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-dim";
  return (
    <svg width="80" height="20" viewBox="0 0 80 20" role="img" aria-label={`${pts.length}-week trend`} className="inline-block align-middle">
      <polyline points={pts.map(xy).join(" ")} fill="none" stroke="currentColor" className="text-mute" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xy(last).split(",")[0]} cy={xy(last).split(",")[1]} r="2.2" fill="currentColor" className={dot} />
    </svg>
  );
}

function Change({ row }: { row: ScoreRow }) {
  if (row.delta == null) return <span className="text-mute">—</span>;
  const tone = deltaTone(row.def, row.delta);
  return <span className={`tabular-nums ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-dim"}`}>{row.delta > 0 ? "+" : "−"}{Math.abs(row.delta * 100).toFixed(0)}%</span>;
}

const SEGMENTS = [
  { min: 3, name: "Headlines", desc: "One win and one worry, one sentence each. No discussion." },
  { min: 7, name: "Pacing and scorecard by exception", desc: "Pacing first: where the week stands against the plan. Then only the rows in Discuss on the call, 60 seconds each: cause, next step." },
  { min: 12, name: "Issues", desc: "The top three from the Board, in order. Each ends as a task with an owner and a date, a logged decision, or a deliberate park." },
  { min: 3, name: "Needs", desc: "Tools, access, budget or decisions someone is waiting on. Answer or assign." },
  { min: 3, name: "Last week's tasks", desc: "Done or not done. Not done gets a new date or gets dropped — no stories." },
  { min: 2, name: "Close", desc: "Read back the new tasks and decisions. End early if there is nothing left." },
];

const SOURCES: [string, string, string][] = [
  ["Did the business make money this week?", "Shopify and Triple Whale", "Revenue, contribution, ad spend, new and returning customers."],
  ["Why did an ad win or lose?", "Meta, on the Creative page", "Hook rate, hold rate, click rate, cost per purchase. Diagnostics only."],
  ["Does a customer pay back?", "Lifetimely", "Cohort value at 30, 60, 90 and 180 days."],
  ["What are customers telling us?", "Commslayer", "Volume, response time, contact reasons."],
  ["Will we run out of stock or cash?", "Inventory and Forecast pages", "Weeks of cover, reorder dates, closing cash by week."],
];

const COVERAGE: [string, string, string, string][] = [
  ["Plan", "Spend, new customers, returning orders and revenue against your Forecast, week by week.", "Pacing tab", "/wbr?tab=pacing"],
  ["Money", "Revenue, contribution, refunds, order value.", "Business rows", "/wbr"],
  ["Acquisition", "Spend against budget, cost per new customer, blended return.", "Acquisition rows", "/wbr"],
  ["Creative engine", "What launched, what won, what is stuck; next week's tests.", "Creative page", "/creative"],
  ["Retention", "Repeat purchase, cohort value, payback.", "Retention rows", "/wbr"],
  ["Customers", "Support load, response time, top contact reasons.", "Customer rows", "/wbr"],
  ["Supply and risk", "Stock on hand, reorder dates, chargebacks.", "Inventory page", "/inventory"],
  ["Cash", "Closing cash by week, supplier payments, the card float.", "Forecast page", "/forecast"],
  ["Needs and commitments", "What someone is waiting on; last week's tasks, done or not done.", "Board tab", "/wbr?tab=board"],
];

export default async function WbrPage({ searchParams }: { searchParams: Promise<{ tab?: string; w?: string }> }) {
  const { tab, w } = await searchParams;
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const s = await buildSnapshot(ctx.db, t);
  const state = await ctx.db.wbrState(t.id);
  const openItems = state.items.filter((i) => i.status === "open" && i.type !== "decision").length;
  const today = new Date().toISOString().slice(0, 10);
  const thisWeek = mondayOnOrBefore(today).toISOString().slice(0, 10);

  if (tab === "board") {
    return (
      <>
        <PageHeader title="Weekly Business Review" subtitle="The board: tasks, issues, needs and the decision log. Add to it any time during the week so the call starts with the list already built." />
        <WbrTabs tab="board" openItems={openItems} />
        <Board items={state.items} week={thisWeek} today={today} canEdit={ctx.canEdit} />
      </>
    );
  }

  if (tab === "agenda") {
    return (
      <>
        <PageHeader title="Weekly Business Review" subtitle="Run of show: 30 minutes, once a week, covering the calendar week that ended Sunday." />
        <WbrTabs tab="agenda" openItems={openItems} />
        <p className="text-sm text-dim max-w-prose mb-5">The call exists to make decisions. Numbers are read before it, updates are written before it, and anything on target is skipped. If the scorecard is clean and the issues list is short, end early.</p>
        <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 mb-6">
          <div className="space-y-5">
            <RunOfShow segments={SEGMENTS} />
            <Card title="Rules of the call">
              <ul className="space-y-2 text-sm text-dim list-disc pl-5 [&_b]:text-ink [&_b]:font-medium">
                <li><b>No status updates.</b> If it can be written, it is written before the call.</li>
                <li><b>On target means skipped.</b> Only missed or wrong-way rows get airtime: cause, next step.</li>
                <li><b>Every issue ends in one of three things.</b> A task with an owner and a date, a logged decision, or a deliberate park.</li>
                <li><b>One owner per number and per task.</b> Two names means nobody.</li>
                <li><b>Ad-by-ad review stays out.</b> That belongs on the Creative page. Only its conclusions come here.</li>
              </ul>
            </Card>
          </div>
          <div className="space-y-5">
            <Card title="Before the call">
              <ul className="space-y-2 text-sm text-dim list-disc pl-5 [&_b]:text-ink [&_b]:font-medium">
                <li><b>Monday morning.</b> The week&apos;s numbers land on This week.</li>
                <li><b>Each owner.</b> Write one line on every row of yours in Discuss on the call.</li>
                <li><b>Everyone.</b> Add issues and needs to the Board. Mark your tasks done or not done.</li>
                <li><b>Whoever runs it.</b> Pick the three issues that matter most.</li>
              </ul>
            </Card>
            <Card title="After the call">
              <ul className="space-y-2 text-sm text-dim list-disc pl-5">
                <li>New tasks are on the Board with an owner and a date before anyone leaves.</li>
                <li>Decisions stay in the log so they are not argued again.</li>
                <li>Targets that changed are updated on the scorecard.</li>
              </ul>
            </Card>
            <Card title="Seats" hint="Set each owner on the scorecard. A seat with no owner is the first hiring or delegation question.">
              <ul className="divide-y divide-line text-sm">
                {SCORE_GROUPS.map((g) => <li key={g.id} className="flex justify-between gap-3 py-2"><span className="text-dim">{g.seat}</span><span className={state.owners[g.id] ? "text-ink" : "text-mute"}>{state.owners[g.id] || "no owner"}</span></li>)}
              </ul>
            </Card>
          </div>
        </div>
        <Card title="What the review covers">
          <div className="overflow-x-auto">
            <table className="table"><tbody>
              {COVERAGE.map(([k, what, where, href]) => <tr key={k}><td className="font-medium text-ink whitespace-nowrap">{k}</td><td className="text-dim">{what}</td><td className="whitespace-nowrap"><Link href={href} className="text-gold-soft hover:underline">{where}</Link></td></tr>)}
            </tbody></table>
          </div>
        </Card>
      </>
    );
  }

  if (tab === "definitions") {
    return (
      <>
        <PageHeader title="Weekly Business Review" subtitle="Definitions: what each number means, where it comes from and when it becomes an issue." />
        <WbrTabs tab="definitions" openItems={openItems} />
        <p className="text-sm text-dim max-w-prose mb-5">Three layers keep the call short. The weekly scorecard is the only thing read every week. Diagnostics, such as hook rate or cost per click, are opened only when a scorecard row is off. Slow numbers, such as 90-day value, are reviewed in the first call of each month.</p>
        <div className="space-y-5">
          <Card title="One source of truth per question">
            <div className="overflow-x-auto"><table className="table"><tbody>
              {SOURCES.map(([q, src, what]) => <tr key={q}><td className="font-medium text-ink">{q}</td><td className="whitespace-nowrap">{src}</td><td className="text-dim">{what}</td></tr>)}
            </tbody></table></div>
          </Card>
          <Card title="How a row gets its status">
            <ul className="space-y-2 text-sm text-dim list-disc pl-5 [&_b]:text-ink [&_b]:font-medium">
              <li><b>With a target.</b> On target, within 10% of target, or missed. Set targets in the Target column of the scorecard. Ad spend is a budget: on target within 15% either way.</li>
              <li><b>Without a target.</b> A row is listed for discussion when it moves against you by 10% or more on last week, or sits 20% or more on the losing side of its median over the previous eight weeks.</li>
              <li><b>Two misses in a row.</b> Put the row on the Board as an issue with its owner&apos;s name on it.</li>
            </ul>
          </Card>
          <Card title="Scorecard definitions">
            <div className="overflow-x-auto"><table className="table" style={{ minWidth: 860 }}>
              <thead><tr><th>Number</th><th>What it means</th><th>Source</th><th>Becomes an issue when</th></tr></thead>
              <tbody>
                {SCORE_GROUPS.map((g) => [
                  <tr key={g.id} className="bg-elev"><td colSpan={4} className="text-xs uppercase tracking-wider text-gold-soft font-medium">{g.name}</td></tr>,
                  ...KPIS.filter((k) => k.group === g.id).map((k) => <tr key={k.id}><td className="font-medium text-ink whitespace-nowrap">{k.name}</td><td className="text-dim">{k.def}</td><td className="text-dim">{k.src}</td><td className="text-dim">{k.rule}</td></tr>),
                ])}
              </tbody>
            </table></div>
          </Card>
        </div>
      </>
    );
  }

  if (tab === "pacing") {
    const saved = await ctx.db.forecastInputs(t.id);
    const starter = !saved && ctx.demo;
    const eightWeeksAgo = shift(s.week.end, -55);
    const inputs = saved ?? defaultForecastInputs(mondayOnOrBefore(eightWeeksAgo).toISOString().slice(0, 10));
    return (
      <>
        <PageHeader title="Weekly Business Review" subtitle="Pacing: how each week is landing against the plan in your Forecast, above or below target." />
        <WbrTabs tab="pacing" openItems={openItems} />
        <PacingView res={runForecast(inputs)} daily={s.daily} weekParam={w} hasPlan={Boolean(saved) || starter} starter={starter} />
      </>
    );
  }

  if (s.daily.length === 0) {
    return (
      <>
        <PageHeader title="Weekly Business Review" />
        <WbrTabs tab="week" openItems={openItems} />
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

  const score = buildScorecard({ weeks: s.history, daily: s.daily, support: s.support, cohorts: s.cohorts, creative: s.creative, forecasts: s.forecasts, chargebackRate: s.chargebackRate, targets: state.targets });
  const rowById = Object.fromEntries(score.map((r) => [r.def.id, r]));
  const measured = score.filter((r) => r.status !== "nodata");
  const blind = score.filter((r) => r.status === "nodata");
  const discuss = measured.filter((r) => r.status === "miss" || r.status === "watch");
  const cs = s.support.filter((x) => x.date >= s.week.start && x.date <= s.week.end);
  const reasons = new Map<string, number>();
  for (const d of cs) for (const r of d.topReasons) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + r.count);

  return (
    <>
      <PageHeader title="Weekly Business Review" subtitle={`Week of ${s.week.start} to ${s.week.end}, compared with ${s.week.prevStart} to ${s.week.prevEnd}. Business truth from Triple Whale; creative diagnostics live on the Creative page.`} />
      <WbrTabs tab="week" openItems={openItems} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {(["revenue", "contribution", "newCustomers", "ncpa"] as const).map((id) => {
          const r = rowById[id];
          const chip = CHIP[r.status];
          return (
            <div key={id} className="card p-4">
              <div className="label mb-1">{r.def.name}</div>
              <div className="text-2xl font-medium text-ink tabular-nums">{fmtKpi(r.value, r.def.fmt)}</div>
              <div className="flex items-center justify-between gap-2 mt-1.5 text-sm">
                <span><Change row={r} /> <span className="text-mute text-xs">on last week</span></span>
                {r.status !== "none" && <Pill tone={chip.tone}>{chip.label}</Pill>}
              </div>
              {id === "ncpa" && allowable != null && <div className="text-xs text-mute mt-1">allowable {fmtMoney(allowable)}</div>}
            </div>
          );
        })}
      </div>

      <section className="mb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
          <h2 className="title text-lg">Discuss on the call</h2>
          <p className="text-xs text-mute">Only rows that missed a target or moved the wrong way. Write one line on cause and next step before the call.</p>
        </div>
        <div className="card">
          {discuss.length === 0 ? <p className="p-4 text-sm text-good">Nothing to discuss: no row missed a target or moved against you. Skip to the Board.</p> : (
            <ul className="divide-y divide-line">
              {discuss.map((r) => (
                <li key={r.def.id} className="grid gap-x-4 gap-y-2 p-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)] md:items-center">
                  <div className="min-w-0"><div className="text-sm font-medium text-ink">{r.def.name}</div><div className="text-xs text-mute">{state.owners[r.def.group] || "no owner"} · {r.reason}</div></div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="tabular-nums text-ink">{fmtKpi(r.value, r.def.fmt)}</span>
                    <Change row={r} />
                    {r.target != null && <span className="text-xs text-mute">target {fmtKpi(r.target, r.def.fmt)}</span>}
                    <Pill tone={CHIP[r.status].tone}>{CHIP[r.status].label}</Pill>
                  </div>
                  <NoteInput week={s.week.start} kpi={r.def.id} value={state.notes[s.week.start]?.[r.def.id] ?? ""} canEdit={ctx.canEdit} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
          <h2 className="title text-lg">Scorecard</h2>
          <p className="text-xs text-mute">Week of {s.week.start} against {s.week.prevStart}. Type a target to turn a row into on target, near or missed.</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="table" style={{ minWidth: 820 }}>
            <thead><tr><th>Number</th><th className="num">This week</th><th className="num">Last week</th><th className="num">Change</th><th className="num">Target</th><th>Status</th><th>Trend</th></tr></thead>
            <tbody>
              {SCORE_GROUPS.map((g) => {
                const rows = measured.filter((r) => r.def.group === g.id);
                if (!rows.length) return null;
                return [
                  <tr key={g.id} className="bg-elev">
                    <td colSpan={7}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs uppercase tracking-wider text-gold-soft font-medium">{g.name}</span>
                        <OwnerInput group={g.id} value={state.owners[g.id] ?? ""} canEdit={ctx.canEdit} />
                      </div>
                    </td>
                  </tr>,
                  ...rows.map((r) => (
                    <tr key={r.def.id} title={`${r.def.def} Source: ${r.def.src}.`}>
                      <td className="text-ink">{r.def.name}</td>
                      <td className="num text-ink">{fmtKpi(r.value, r.def.fmt)}</td>
                      <td className="num text-dim">{r.def.slow ? <span className="text-mute text-xs">monthly</span> : fmtKpi(r.prev, r.def.fmt)}</td>
                      <td className="num"><Change row={r} /></td>
                      <td className="num"><TargetInput kpi={r.def.id} value={r.target == null ? null : targetToDisplay(r.target, r.def.fmt)} toStored={r.def.fmt === "pct" || r.def.fmt === "pct1" ? "pct" : "raw"} canEdit={ctx.canEdit} /></td>
                      <td><span title={r.reason || undefined}><Pill tone={CHIP[r.status].tone}>{CHIP[r.status].label}</Pill></span></td>
                      <td><Spark values={r.series} tone={deltaTone(r.def, r.delta)} /></td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-mute mt-2">Percent targets are typed as a number (12 for 12%). Hover a row for its definition, or open <Link href="/wbr?tab=definitions" className="text-gold-soft hover:underline">Definitions</Link>.</p>
      </section>

      {blind.length > 0 && (
        <section className="mb-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
            <h2 className="title text-lg">Not measured yet</h2>
            <p className="text-xs text-mute">These belong on the scorecard, but nothing connected can supply them.</p>
          </div>
          <div className="card overflow-x-auto">
            <table className="table" style={{ minWidth: 640 }}>
              <thead><tr><th>Number</th><th>Why it matters</th><th>What would supply it</th></tr></thead>
              <tbody>
                {blind.map((r) => <tr key={r.def.id}><td className="text-ink whitespace-nowrap">{r.def.name}</td><td className="text-dim">{r.def.rule}</td><td className="text-dim">{r.def.connect ?? `Comes from ${r.def.src}.`}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
