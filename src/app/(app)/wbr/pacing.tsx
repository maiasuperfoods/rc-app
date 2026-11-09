import Link from "next/link";
import { Card, Pill, fmtMoney } from "@/components/ui";
import type { ForecastResult } from "@/lib/calc/forecast";
import { buildPacing, cumulativeRevenue, paceStatus, type PaceRow, type PaceStatus, type PaceWeek } from "@/lib/calc/pacing";
import type { DailyBusinessMetrics } from "@/lib/types";

const TONE: Record<PaceStatus, "good" | "warn" | "bad" | "mute"> = { ok: "good", near: "warn", watch: "warn", miss: "bad", none: "mute" };
const BAR: Record<PaceStatus, string> = { ok: "bg-good", near: "bg-warn", watch: "bg-warn", miss: "bg-bad", none: "bg-mute" };
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const fmt = (v: number | null, f: PaceRow["format"]) => (v == null ? "—" : f === "money" ? fmtMoney(v) : Math.round(v).toLocaleString());
const day = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const short = (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M` : Math.abs(v) >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);

/** Bar where the tick in the middle is 100% of plan; a full bar is 200%. */
function Meter({ pace, status }: { pace: number | null; status: PaceStatus }) {
  if (pace == null) return <span className="text-mute">—</span>;
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`${pct(pace)} of plan`}>
      <span className="relative inline-block w-24 h-2 rounded bg-hover">
        <i className={`absolute inset-y-0 left-0 rounded ${BAR[status]}`} style={{ width: `${Math.min(100, pace * 50)}%` }} />
        <i className="absolute -top-1 -bottom-1 left-1/2 w-0.5 -ml-px bg-dim" />
      </span>
      <span className="tabular-nums text-ink">{pct(pace)}</span>
    </span>
  );
}

function Delta({ actual, plan, format }: { actual: number | null; plan: number; format: PaceRow["format"] }) {
  if (actual == null || plan <= 0) return <span className="text-mute">—</span>;
  const d = actual - plan;
  return <span className={`tabular-nums ${d >= 0 ? "text-good" : "text-bad"}`}>{d >= 0 ? "+" : "−"}{fmt(Math.abs(d), format)}</span>;
}

export function PacingView({ res, daily, weekParam, hasPlan, starter }: { res: ForecastResult; daily: DailyBusinessMetrics[]; weekParam?: string; hasPlan: boolean; starter: boolean }) {
  const through = daily.length ? daily.reduce((m, d) => (d.date > m ? d.date : m), daily[0].date) : null;
  const weeks = buildPacing(res, daily, through);

  if (!hasPlan) {
    return (
      <div className="card-elev p-8 text-center max-w-2xl mx-auto">
        <div className="title text-xl mb-2">No plan to pace against yet</div>
        <p className="text-sm text-dim mb-5">Pacing compares every week with the plan in your Forecast: ad spend, new customers, returning orders and revenue. Set up the Forecast and save it, and this tab fills in from your Shopify and Triple Whale numbers.</p>
        <Link href="/forecast" className="btn btn-primary">Open the Forecast</Link>
      </div>
    );
  }
  if (!weeks.length) {
    return (
      <div className="card p-6 text-sm text-dim">
        Your plan starts the week of <span className="text-ink">{day(res.weeks[0]?.start ?? "")}</span>. Pacing shows here once there are actuals inside the plan period{through ? ` (data runs through ${day(through)})` : ""}.
      </div>
    );
  }

  const sel = weeks.find((w) => String(w.idx + 1) === weekParam) ?? weeks[weeks.length - 1];
  const totals = weeks.reduce(
    (a, w) => {
      for (const r of w.rows) {
        a[r.key].actual += r.actual ?? 0;
        a[r.key].plan += r.planToDate;
      }
      return a;
    },
    { spend: { actual: 0, plan: 0 }, newCustomers: { actual: 0, plan: 0 }, rebills: { actual: 0, plan: 0 }, revenue: { actual: 0, plan: 0 } },
  );
  const behind = weeks.filter((w) => w.complete && w.rows.find((r) => r.key === "revenue")!.status === "miss").length;
  const ahead = weeks.filter((w) => w.complete && w.rows.find((r) => r.key === "revenue")!.status === "ok").length;
  const done = weeks.filter((w) => w.complete).length;

  return (
    <div className="space-y-6">
      {starter && (
        <div className="rounded-md border border-gold/30 bg-gold-dim px-4 py-2.5 text-sm text-gold-soft">
          This is pacing against the starter plan. Save your own model in the <Link href="/forecast" className="underline">Forecast</Link> and every number here follows it.
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label mb-1">Week</div>
          <div className="flex flex-wrap gap-1.5">
            {weeks.map((w) => {
              const rev = w.rows.find((r) => r.key === "revenue")!;
              const on = w.idx === sel.idx;
              return (
                <Link
                  key={w.idx}
                  href={`/wbr?tab=pacing&w=${w.idx + 1}`}
                  scroll={false}
                  className={`px-2.5 py-1 rounded-md border text-xs tabular-nums ${on ? "border-gold text-ink bg-gold-dim" : "border-line text-dim hover:text-ink"}`}
                  title={`${w.isoLabel}, ${day(w.start)} to ${day(w.end)}: revenue ${pct(rev.pace)} of plan`}
                >
                  <i className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${BAR[rev.status]}`} />
                  {w.isoLabel}
                </Link>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-mute max-w-md">Actuals through {through ? day(through) : "—"}. A week&apos;s plan is spread evenly over its days, so a week in progress is compared with the plan for the days so far.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {sel.rows.map((r) => (
          <div key={r.key} className="card p-4">
            <div className="label">{r.name}</div>
            <div className="text-[1.6rem] font-semibold tabular-nums text-ink leading-tight mt-1">{pct(r.pace)}</div>
            <div className="text-xs text-dim mt-1">{fmt(r.actual, r.format)} against {fmt(r.planToDate, r.format)} planned{sel.complete ? "" : " to date"}</div>
            <div className="mt-2"><Pill tone={TONE[r.status]}>{r.label}</Pill></div>
          </div>
        ))}
      </div>

      <Card
        title={`${sel.isoLabel}, ${day(sel.start)} to ${day(sel.end)}`}
        hint={`${sel.dataDays} of ${sel.planDays} plan days in.${sel.complete ? "" : " The tick on each bar is 100% of plan."}`}
      >
        <div className="overflow-x-auto">
          <table className="table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Measure</th>
                <th className="num">Actual</th>
                <th className="num">Plan{sel.complete ? "" : " to date"}</th>
                <th>Pace</th>
                <th className="num">Above / below</th>
                <th className="num">{sel.complete ? "" : "On track for"}</th>
                <th className="num">Plan for the week</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sel.rows.map((r) => (
                <tr key={r.key}>
                  <td className="font-medium text-ink">{r.name}{r.kind === "band" && <span className="text-mute text-xs"> · on plan within 10%</span>}</td>
                  <td className="num">{fmt(r.actual, r.format)}</td>
                  <td className="num text-dim">{fmt(r.planToDate, r.format)}</td>
                  <td><Meter pace={r.pace} status={r.status} /></td>
                  <td className="num">{r.kind === "band" ? <span className="tabular-nums text-dim">{r.actual == null ? "—" : `${r.actual >= r.planToDate ? "+" : "−"}${fmt(Math.abs(r.actual - r.planToDate), r.format)}`}</span> : <Delta actual={r.actual} plan={r.planToDate} format={r.format} />}</td>
                  <td className="num">{sel.complete ? "" : fmt(r.projected, r.format)}</td>
                  <td className="num text-dim">{fmt(r.planFull, r.format)}</td>
                  <td><Pill tone={TONE[r.status]}>{r.label}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Cumulative revenue against the plan" className="lg:col-span-2" hint="Solid: actual to date. Dashed: the plan, with the next four weeks ahead.">
          <CumChart res={res} daily={daily} through={through!} />
        </Card>
        <Card title="Plan to date" hint={`${weeks.length} plan week${weeks.length === 1 ? "" : "s"} so far`}>
          <ul className="space-y-3">
            {(Object.keys(totals) as (keyof typeof totals)[]).map((k) => {
              const row = sel.rows.find((r) => r.key === k)!;
              const t = totals[k], p = t.plan > 0 ? t.actual / t.plan : null, [st, lab] = paceStatus(row.kind, p);
              return (
                <li key={k} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-ink">{row.name}</div>
                    <div className="text-xs text-mute tabular-nums">{fmt(t.actual, row.format)} of {fmt(t.plan, row.format)}</div>
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums text-ink">{pct(p)}</div>
                    <Pill tone={TONE[st]}>{lab}</Pill>
                  </div>
                </li>
              );
            })}
          </ul>
          {done > 0 && <p className="text-xs text-dim mt-4 pt-3 border-t border-line">Revenue was ahead of plan in {ahead} of {done} full week{done === 1 ? "" : "s"}, and more than 10% behind in {behind}.</p>}
        </Card>
      </div>

      <Card title="Week by week" hint="Green is at or above plan, amber within 10%, red more than 10% behind. Ad spend is on plan within 10% either way.">
        <div className="overflow-x-auto">
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Week</th>
                <th className="num">Revenue</th><th className="num">Plan</th><th>Pace</th>
                <th className="num">Ad spend</th><th className="num">Plan</th>
                <th className="num">New customers</th><th className="num">Plan</th>
                <th className="num">Returning orders</th><th className="num">Plan</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w: PaceWeek) => {
                const g = (k: PaceRow["key"]) => w.rows.find((r) => r.key === k)!;
                const cell = (r: PaceRow) => (
                  <>
                    <td className={`num ${r.status === "miss" ? "text-bad" : r.status === "ok" ? "text-good" : r.status === "none" ? "" : "text-warn"}`}>{fmt(r.actual, r.format)}</td>
                    <td className="num text-dim">{fmt(r.planToDate, r.format)}</td>
                  </>
                );
                return (
                  <tr key={w.idx} className={w.idx === sel.idx ? "bg-gold-dim" : ""}>
                    <td>
                      <Link href={`/wbr?tab=pacing&w=${w.idx + 1}`} scroll={false} className="text-ink hover:text-gold">{w.isoLabel}</Link>
                      <span className="text-xs text-mute"> · {day(w.start)}{w.complete ? "" : ` · ${w.dataDays} of ${w.planDays} days`}</span>
                    </td>
                    {cell(g("revenue"))}
                    <td><Meter pace={g("revenue").pace} status={g("revenue").status} /></td>
                    {cell(g("spend"))}
                    {cell(g("newCustomers"))}
                    {cell(g("rebills"))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-mute">Returning orders are compared with the plan&apos;s rebills. Revenue includes first orders, upsells and rebills. The plan is your saved Forecast, summed across every product line.</p>
    </div>
  );
}

function CumChart({ res, daily, through }: { res: ForecastResult; daily: DailyBusinessMetrics[]; through: string }) {
  const pts = cumulativeRevenue(res, daily, through);
  if (!pts.length) return null;
  const W = 720, H = 240, l = 56, r = 16, t = 14, b = 28, iw = W - l - r, ih = H - t - b, n = pts.length;
  const max = Math.max(1, ...pts.map((p) => Math.max(p.plan, p.actual ?? 0)));
  const x = (i: number) => l + (n > 1 ? (i / (n - 1)) * iw : 0);
  const y = (v: number) => t + ih - (v / max) * ih;
  const pp = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.plan).toFixed(1)}`).join(" ");
  const act = pts.map((p, i) => ({ p, i })).filter((q) => q.p.actual != null);
  const ap = act.map(({ p, i }) => `${x(i).toFixed(1)},${y(p.actual!).toFixed(1)}`).join(" ");
  const last = act[act.length - 1];
  const gap = last ? last.p.actual! - last.p.plan : 0;
  const labels = [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cumulative revenue, actual against plan" className="block" style={{ fontSize: 11 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={l} x2={W - r} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" />
            <text x={l - 6} y={y(max * f) + 4} textAnchor="end" fill="var(--text-mute)">{short(max * f)}</text>
          </g>
        ))}
        <polyline points={pp} fill="none" stroke="var(--text-mute)" strokeWidth={2} strokeDasharray="5 4" />
        {ap && <polyline points={ap} fill="none" stroke="var(--gold)" strokeWidth={2.5} strokeLinejoin="round" />}
        {last && <circle cx={x(last.i)} cy={y(last.p.actual!)} r={4} fill="var(--gold)" />}
        {labels.map((i, k) => <text key={k} x={x(i)} y={H - 8} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} fill="var(--text-mute)">{day(pts[i].date)}</text>)}
      </svg>
      {last && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-dim mt-2">
          <span className="inline-flex items-center gap-2"><i className="inline-block w-4 h-0.5 rounded bg-gold" />Revenue to date, {fmtMoney(last.p.actual!)}</span>
          <span className="inline-flex items-center gap-2"><i className="inline-block w-4 border-t border-dashed border-mute" />Plan to date, {fmtMoney(last.p.plan)}</span>
          <span className={gap >= 0 ? "text-good" : "text-bad"}>{gap >= 0 ? `${fmtMoney(gap)} ahead of plan` : `${fmtMoney(-gap)} behind plan`}</span>
        </div>
      )}
    </div>
  );
}
