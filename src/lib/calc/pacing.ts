/**
 * Pacing: the brand's actuals against its own saved Forecast, week by week.
 *
 * The plan is the Forecast (runForecast) summed across product lines. Each plan
 * week's number is spread evenly over its active days, so a week in progress is
 * compared with the plan for the days that have data ("plan to date").
 * Pure functions, no I/O.
 */
import type { ForecastResult } from "./forecast";
import type { DailyBusinessMetrics } from "@/lib/types";

export type PaceKind = "up" | "down" | "band";
export type PaceStatus = "ok" | "near" | "miss" | "watch" | "none";

export interface PaceRow {
  key: "spend" | "newCustomers" | "rebills" | "revenue";
  name: string;
  format: "money" | "int";
  kind: PaceKind;
  actual: number | null;
  planToDate: number;
  planFull: number;
  pace: number | null; // actual ÷ plan to date
  projected: number | null; // where the week lands at this pace
  status: PaceStatus;
  label: string;
}

export interface PaceWeek {
  idx: number; // 0-based plan week
  isoLabel: string;
  start: string;
  end: string;
  planDays: number;
  dataDays: number;
  complete: boolean;
  rows: PaceRow[];
}

const MEASURES: { key: PaceRow["key"]; name: string; format: PaceRow["format"]; kind: PaceKind }[] = [
  { key: "spend", name: "Ad spend", format: "money", kind: "band" },
  { key: "newCustomers", name: "New customers", format: "int", kind: "up" },
  { key: "rebills", name: "Returning orders", format: "int", kind: "up" },
  { key: "revenue", name: "Revenue", format: "money", kind: "up" },
];

export function paceStatus(kind: PaceKind, pace: number | null): [PaceStatus, string] {
  if (pace == null || !isFinite(pace)) return ["none", "No data"];
  if (kind === "up") return pace >= 1 ? ["ok", "Ahead of plan"] : pace >= 0.9 ? ["near", "Within 10%"] : ["miss", "Behind plan"];
  if (kind === "down") return pace <= 1 ? ["ok", "At or under plan"] : pace <= 1.1 ? ["near", "Within 10%"] : ["miss", "Over plan"];
  return Math.abs(pace - 1) <= 0.1 ? ["ok", "On plan"] : ["watch", pace > 1 ? "Over plan" : "Under plan"];
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Weekly plan totals across every product line. */
export function planWeeks(res: ForecastResult) {
  return res.weeks.map((w, i) => ({
    ...w,
    spend: res.lines.reduce((a, l) => a + (l.weeks[i]?.spend ?? 0), 0),
    newCustomers: res.lines.reduce((a, l) => a + (l.weeks[i]?.newOrders ?? 0), 0),
    rebills: res.lines.reduce((a, l) => a + (l.weeks[i]?.rebills ?? 0), 0),
    revenue: res.lines.reduce((a, l) => a + (l.weeks[i]?.revenue ?? 0), 0),
  }));
}

/**
 * Pace every plan week that has started, through the last day with data.
 * `through` is the last date the actuals cover.
 */
export function buildPacing(res: ForecastResult, daily: DailyBusinessMetrics[], through: string | null): PaceWeek[] {
  if (!through) return [];
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const plan = planWeeks(res);
  const out: PaceWeek[] = [];
  for (const w of plan) {
    // the active days of a plan week (the first week may start mid-week)
    const from = addDays(w.end, -(w.activeDays - 1));
    if (from > through) break;
    let dataDays = 0;
    const act = { spend: 0, newCustomers: 0, rebills: 0, revenue: 0 };
    for (let d = from; d <= w.end && d <= through; d = addDays(d, 1)) {
      const x = byDate.get(d);
      if (!x) continue;
      dataDays++;
      act.spend += x.adSpend;
      act.newCustomers += x.newCustomers;
      act.rebills += x.returningCustomers;
      act.revenue += x.revenue;
    }
    const frac = w.activeDays ? dataDays / w.activeDays : 0;
    const rows: PaceRow[] = MEASURES.map((m) => {
      const planFull = w[m.key];
      const planToDate = planFull * frac;
      const actual = dataDays ? act[m.key] : null;
      const pace = actual != null && planToDate > 0 ? actual / planToDate : null;
      const [status, label] = paceStatus(m.kind, pace);
      return { ...m, actual, planToDate, planFull, pace, projected: actual != null && frac > 0 ? actual / frac : null, status, label };
    });
    out.push({ idx: w.idx - 1, isoLabel: w.isoLabel, start: from, end: w.end, planDays: w.activeDays, dataDays, complete: dataDays >= w.activeDays, rows });
  }
  return out;
}

/** Cumulative revenue, actual against plan, day by day over the plan weeks that have started. */
export function cumulativeRevenue(res: ForecastResult, daily: DailyBusinessMetrics[], through: string, weeksAhead = 4) {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const plan = planWeeks(res);
  const pts: { date: string; plan: number; actual: number | null }[] = [];
  let cp = 0, ca = 0;
  const lastWeek = plan.findIndex((w) => w.end >= through);
  const stop = plan[Math.min(plan.length - 1, (lastWeek < 0 ? plan.length - 1 : lastWeek) + weeksAhead)]?.end ?? through;
  for (const w of plan) {
    const from = addDays(w.end, -(w.activeDays - 1));
    if (from > stop) break;
    for (let d = from; d <= w.end; d = addDays(d, 1)) {
      cp += w.revenue / w.activeDays;
      let a: number | null = null;
      if (d <= through) {
        ca += byDate.get(d)?.revenue ?? 0;
        a = ca;
      }
      pts.push({ date: d, plan: cp, actual: a });
    }
  }
  return pts;
}
