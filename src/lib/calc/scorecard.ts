/**
 * The weekly scorecard: every number the review reads, grouped by the seat that owns it, with this
 * week against last week, against a target if one is set, and against its own recent history.
 *
 * Three layers keep the call short. The scorecard is read every week. Diagnostics live on their
 * own pages (Creative, Inventory) and are opened only when a row here is off. Slow numbers such
 * as 90-day value change monthly and are shown without a week-on-week move.
 *
 * Pure functions, no I/O.
 */
import type { CohortRow, DailyBusinessMetrics, DailySupportMetrics, WbrMetrics } from "@/lib/types";
import type { CreativeOverview } from "@/lib/calc/creative";
import type { SkuForecast } from "@/lib/calc/inventory";

export type Fmt = "money" | "money2" | "pct" | "pct1" | "int" | "x" | "num1" | "mins";
export type Good = "up" | "down" | "none";
export type ScoreStatus = "ok" | "near" | "miss" | "watch" | "none" | "nodata";

export interface ScoreGroup { id: string; name: string; seat: string }
export const SCORE_GROUPS: ScoreGroup[] = [
  { id: "business", name: "Business", seat: "Money and margin" },
  { id: "acquisition", name: "Acquisition", seat: "Paid media" },
  { id: "funnel", name: "Site and offer", seat: "Funnel and landing pages" },
  { id: "retention", name: "Retention", seat: "Repeat purchase and lifetime value" },
  { id: "cx", name: "Customer experience", seat: "Support" },
  { id: "creative", name: "Creative engine", seat: "Creative production" },
  { id: "ops", name: "Operations and risk", seat: "Supply, fulfillment, payments" },
];

export interface KpiDef {
  id: string;
  group: string;
  name: string;
  fmt: Fmt;
  good: Good;
  /** What the number means. */
  def: string;
  /** Where it comes from. */
  src: string;
  /** When it becomes something to act on. */
  rule: string;
  /** Shown when nothing connected can supply it: what to connect or do. */
  connect?: string;
  /** Changes monthly, not weekly: shown without a week-on-week move. */
  slow?: boolean;
}

export const KPIS: KpiDef[] = [
  { id: "revenue", group: "business", name: "Revenue", fmt: "money", good: "up", def: "Order revenue for the calendar week, Monday to Sunday.", src: "Shopify", rule: "Below target two weeks running." },
  { id: "contribution", group: "business", name: "Contribution after ads", fmt: "money", good: "up", def: "Revenue minus refunds, product cost, shipping and fulfillment, payment fees and ad spend.", src: "Shopify, Triple Whale and your Unit Economics", rule: "Below target, or falling while spend rises." },
  { id: "contribPct", group: "business", name: "Contribution margin", fmt: "pct", good: "up", def: "Contribution after ads divided by revenue.", src: "Calculated", rule: "Below the floor you set for the brand." },
  { id: "mer", group: "business", name: "Ad spend share of revenue", fmt: "pct", good: "down", def: "Total ad spend divided by revenue. The inverse view of blended ROAS.", src: "Triple Whale and Shopify", rule: "Above the ceiling you set for the brand." },
  { id: "refundRate", group: "business", name: "Refund rate", fmt: "pct1", good: "down", def: "Refunds divided by revenue.", src: "Shopify", rule: "Above target, or a jump tied to one product or offer." },
  { id: "aov", group: "business", name: "Average order value", fmt: "money2", good: "up", def: "Revenue divided by orders.", src: "Shopify", rule: "A drop of 10% or more after an offer or page change." },
  { id: "orders", group: "business", name: "Orders", fmt: "int", good: "up", def: "Orders placed in the week.", src: "Shopify", rule: "Context for revenue and support load." },

  { id: "adSpend", group: "acquisition", name: "Ad spend", fmt: "money", good: "none", def: "All paid channels combined.", src: "Triple Whale", rule: "Off the weekly budget by 15% either way." },
  { id: "newCustomers", group: "acquisition", name: "New customers", fmt: "int", good: "up", def: "First-time orders.", src: "Triple Whale", rule: "Below the weekly number the plan needs." },
  { id: "ncpa", group: "acquisition", name: "Cost per new customer", fmt: "money", good: "down", def: "Ad spend divided by new customers.", src: "Triple Whale", rule: "Above your allowable two weeks running: cut the worst ad sets, then raise it as an issue." },
  { id: "blendedRoas", group: "acquisition", name: "Blended ROAS", fmt: "x", good: "up", def: "Revenue divided by ad spend, all customers.", src: "Triple Whale and Shopify", rule: "Below the floor your margins can carry." },
  { id: "ncAov", group: "acquisition", name: "First-order value (NC-AOV)", fmt: "money", good: "up", def: "New-customer revenue divided by new-customer orders.", src: "Triple Whale", rule: "Falls while cost per new customer holds or rises.", connect: "Connect Triple Whale on the Connections page; it supplies new-customer revenue." },
  { id: "ncRoas", group: "acquisition", name: "NC-ROAS", fmt: "x", good: "up", def: "New-customer revenue divided by ad spend.", src: "Triple Whale", rule: "Below the floor that 90-day value can pay back.", connect: "Connect Triple Whale on the Connections page; it supplies new-customer revenue." },

  { id: "sessions", group: "funnel", name: "Sessions", fmt: "int", good: "up", def: "Store sessions for the week.", src: "Triple Whale pixel", rule: "Moves out of line with spend.", connect: "Needs session counts from the Triple Whale pixel, which the sync does not store yet." },
  { id: "cvr", group: "funnel", name: "Conversion rate", fmt: "pct1", good: "up", def: "Orders divided by sessions.", src: "Triple Whale pixel", rule: "A drop of 10% or more: check page, offer and checkout before blaming creative.", connect: "Needs session counts from the Triple Whale pixel." },

  { id: "retShare", group: "retention", name: "Returning share of orders", fmt: "pct", good: "none", def: "Returning-customer orders divided by all orders.", src: "Triple Whale", rule: "Context for the mix between acquisition and repeat purchase." },
  { id: "ltv90", group: "retention", name: "90-day sales per customer", fmt: "money", good: "up", def: "Average sales per customer in the first three months, latest cohort old enough to have it.", src: "Lifetimely", rule: "Must stay above cost per new customer plus product and shipping cost.", connect: "Connect Lifetimely on the Connections page.", slow: true },
  { id: "repurchase", group: "retention", name: "Repurchase rate", fmt: "pct", good: "up", def: "Share of the latest cohort that bought again.", src: "Lifetimely", rule: "Falls for two cohorts in a row.", connect: "Connect Lifetimely on the Connections page.", slow: true },
  { id: "activeSubs", group: "retention", name: "Active subscribers", fmt: "int", good: "up", def: "Subscribers with a live subscription at week end.", src: "Subscription platform", rule: "Falls week over week.", connect: "No subscription platform is connected. Track it by hand on the Board until one is." },
  { id: "subChurn", group: "retention", name: "Subscriber churn", fmt: "pct", good: "down", def: "Subscribers who cancelled in the week divided by active subscribers at the start.", src: "Subscription platform", rule: "Above target.", connect: "Same connection as active subscribers." },

  { id: "tickets", group: "cx", name: "Support conversations", fmt: "int", good: "down", def: "Conversations opened in the week.", src: "Commslayer", rule: "A rise not explained by order volume.", connect: "Connect Commslayer on the Connections page." },
  { id: "ticketsPer100", group: "cx", name: "Conversations per 100 orders", fmt: "num1", good: "down", def: "Conversations opened divided by orders, times 100.", src: "Commslayer and Shopify", rule: "Above target.", connect: "Connect Commslayer on the Connections page." },
  { id: "firstResponse", group: "cx", name: "First response time", fmt: "mins", good: "down", def: "Average minutes to the first reply.", src: "Commslayer", rule: "Above the promise you make customers.", connect: "Connect Commslayer on the Connections page." },
  { id: "refundRequests", group: "cx", name: "Refund requests", fmt: "int", good: "down", def: "Conversations asking for a refund.", src: "Commslayer", rule: "A rise ahead of the refund rate is the early warning.", connect: "Connect Commslayer on the Connections page." },
  { id: "csat", group: "cx", name: "Customer satisfaction", fmt: "pct", good: "up", def: "Share of survey ratings that are 4 or 5.", src: "Commslayer", rule: "Below target.", connect: "Turn on the satisfaction survey in Commslayer; the sync does not read it yet." },

  { id: "launched", group: "creative", name: "Ads launched, last 14 days", fmt: "int", good: "up", def: "New ads that started spending in the last two weeks.", src: "Meta", rule: "Below the weekly quota you set for the creative engine.", connect: "Connect Meta on the Connections page.", slow: true },
  { id: "hitRate", group: "creative", name: "Hit rate, last 30 days", fmt: "pct", good: "up", def: "Tested ads that became winners under your Creative rules, divided by ads tested.", src: "Meta and Triple Whale", rule: "Below target over a rolling four weeks.", connect: "Connect Meta on the Connections page.", slow: true },
  { id: "creativeRoas", group: "creative", name: "New-customer ROAS on ads, last 30 days", fmt: "x", good: "up", def: "New-customer revenue attributed to ads divided by their spend.", src: "Triple Whale pixel", rule: "Below the floor that 90-day value can pay back.", connect: "Connect Meta and Triple Whale on the Connections page.", slow: true },

  { id: "inventoryWeeks", group: "ops", name: "Weeks of inventory cover", fmt: "num1", good: "up", def: "The product closest to running out: units on hand and inbound divided by weekly sales at your planned spend.", src: "Shopify inventory and your Inventory plan", rule: "Below supplier lead time plus a safety margin.", connect: "Needs inventory from Shopify and a supplier lead time on the Inventory page.", slow: true },
  { id: "chargebackRate", group: "ops", name: "Chargeback alerts per order", fmt: "pct1", good: "down", def: "Chargeback alerts divided by orders over the last 60 days.", src: "Commslayer and Shopify", rule: "Approaching your payment processor's threshold.", connect: "Connect Commslayer, or pull it weekly from your payment processor.", slow: true },
  { id: "fulfillDays", group: "ops", name: "Order to ship time", fmt: "num1", good: "down", def: "Average days from order to shipment.", src: "Fulfillment partner", rule: "Above your shipping promise.", connect: "No fulfillment source is connected. Ask your 3PL for the weekly figure." },
];
export const KPI_BY_ID = Object.fromEntries(KPIS.map((k) => [k.id, k]));

export interface ScoreRow {
  def: KpiDef;
  value: number | null;
  prev: number | null;
  /** Fractional change on last week; null when either side is missing or the row is slow. */
  delta: number | null;
  /** Oldest first, ending with this week. */
  series: (number | null)[];
  target: number | null;
  status: ScoreStatus;
  /** Why it has that status, in a few words. */
  reason: string;
}

export interface WeekWindow { start: string; end: string; metrics: WbrMetrics }

/** Weekly value of every KPI that can be computed from one week of daily rows. */
function weekly(id: string, w: WeekWindow, daily: DailyBusinessMetrics[], support: DailySupportMetrics[], hasSupport: boolean): number | null {
  const m = w.metrics;
  const rows = daily.filter((d) => d.date >= w.start && d.date <= w.end);
  if (!rows.length) return null;
  const sup = support.filter((d) => d.date >= w.start && d.date <= w.end);
  switch (id) {
    case "revenue": return m.revenue;
    case "contribution": return m.contributionMargin;
    case "contribPct": return m.revenue > 0 ? m.contributionMarginPct : null;
    case "mer": return m.revenue > 0 ? m.adSpend / m.revenue : null;
    case "refundRate": return m.revenue > 0 ? m.refundRate : null;
    case "aov": return m.orders > 0 ? m.aov : null;
    case "orders": return m.orders;
    case "adSpend": return m.adSpend;
    case "newCustomers": return m.newCustomers;
    case "ncpa": return m.newCustomers > 0 ? m.ncpa : null;
    case "blendedRoas": return m.adSpend > 0 ? m.blendedRoas : null;
    case "ncRoas": {
      const nc = rows.filter((r) => r.newCustomerRevenue != null);
      const spend = nc.reduce((a, r) => a + r.adSpend, 0);
      return nc.length && spend > 0 ? nc.reduce((a, r) => a + (r.newCustomerRevenue ?? 0), 0) / spend : null;
    }
    case "ncAov": {
      const nc = rows.filter((r) => r.newCustomerRevenue != null);
      const n = nc.reduce((a, r) => a + r.newCustomers, 0);
      return nc.length && n > 0 ? nc.reduce((a, r) => a + (r.newCustomerRevenue ?? 0), 0) / n : null;
    }
    case "retShare": return m.orders > 0 ? rows.reduce((a, r) => a + r.returningCustomers, 0) / m.orders : null;
    case "tickets": return hasSupport && sup.length ? sup.reduce((a, r) => a + r.tickets, 0) : null;
    case "ticketsPer100": return hasSupport && sup.length && m.orders > 0 ? (sup.reduce((a, r) => a + r.tickets, 0) / m.orders) * 100 : null;
    case "firstResponse": return hasSupport && sup.length ? sup.reduce((a, r) => a + r.firstResponseMinutes, 0) / sup.length : null;
    case "refundRequests": return hasSupport && sup.length ? sup.reduce((a, r) => a + r.refundRequests, 0) : null;
    default: return null;
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/**
 * How a row gets its status.
 *  With a target: on target, within 10% of it, or missed.
 *  Without one: listed for discussion when it moved against you by 10% or more on last week, or
 *  sits 20% or more on the losing side of its median over the previous eight weeks.
 */
export function scoreStatus(def: KpiDef, value: number | null, prev: number | null, history: number[], target: number | null): [ScoreStatus, string] {
  if (value == null) return ["nodata", ""];
  if (target != null && target !== 0) {
    if (def.good === "none") {
      const off = Math.abs(value - target) / Math.abs(target);
      return off <= 0.15 ? ["ok", "within 15% of budget"] : ["miss", `${Math.round(off * 100)}% ${value > target ? "over" : "under"} budget`];
    }
    const up = def.good === "up";
    if (up ? value >= target : value <= target) return ["ok", "on target"];
    if (up ? value >= target * 0.9 : value <= target * 1.1) return ["near", "within 10% of target"];
    return ["miss", "missed target"];
  }
  if (def.good === "none" || def.slow) return ["none", ""];
  const against = (from: number) => (from === 0 ? 0 : def.good === "up" ? (from - value) / Math.abs(from) : (value - from) / Math.abs(from));
  if (prev != null && against(prev) >= 0.1) return ["watch", `${Math.round(against(prev) * 100)}% the wrong way on last week`];
  const med = median(history);
  if (med != null && history.length >= 4 && against(med) >= 0.2) return ["watch", `${Math.round(against(med) * 100)}% worse than its ${history.length}-week median`];
  return ["none", ""];
}

export interface ScorecardInput {
  /** Complete weeks, oldest first; the last one is the week under review. */
  weeks: WeekWindow[];
  daily: DailyBusinessMetrics[];
  support: DailySupportMetrics[];
  cohorts: CohortRow[];
  creative: CreativeOverview;
  forecasts: SkuForecast[];
  chargebackRate: number | null;
  targets: Record<string, number>;
}

export function buildScorecard(inp: ScorecardInput): ScoreRow[] {
  const hasSupport = inp.support.length > 0;
  const cohort90 = [...inp.cohorts].reverse().find((c) => c.ltv90 > 0) ?? null;
  const latestCohort = inp.cohorts[inp.cohorts.length - 1] ?? null;
  const cover = inp.forecasts.map((f) => f.daysOfCover).filter((d): d is number => d != null);
  const point: Record<string, number | null> = {
    ltv90: cohort90 ? cohort90.ltv90 : null,
    repurchase: latestCohort ? latestCohort.repurchaseRate : null,
    launched: inp.creative.spend > 0 || inp.creative.tested > 0 ? inp.creative.launched2w : null,
    hitRate: inp.creative.tested > 0 ? inp.creative.hitRate : null,
    creativeRoas: inp.creative.spend > 0 ? inp.creative.ncRoas : null,
    inventoryWeeks: cover.length ? Math.min(...cover) / 7 : null,
    chargebackRate: inp.chargebackRate,
  };

  return KPIS.map((def) => {
    const target = inp.targets[def.id] ?? null;
    if (def.id in point) {
      const value = point[def.id];
      const [status, reason] = scoreStatus(def, value, null, [], target);
      return { def, value, prev: null, delta: null, series: [], target, status, reason };
    }
    const series = inp.weeks.map((w) => weekly(def.id, w, inp.daily, inp.support, hasSupport));
    const value = series.length ? series[series.length - 1] : null;
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const history = series.slice(0, -1).filter((v): v is number => v != null).slice(-8);
    const [status, reason] = scoreStatus(def, value, prev, history, target);
    const delta = value != null && prev != null && prev !== 0 ? (value - prev) / Math.abs(prev) : null;
    return { def, value, prev, delta, series, target, status, reason };
  });
}

/** Whether a move is good, bad or neither for this row. */
export function deltaTone(def: KpiDef, delta: number | null): "good" | "bad" | "flat" {
  if (delta == null || def.good === "none" || Math.abs(delta) < 0.005) return "flat";
  return (delta > 0) === (def.good === "up") ? "good" : "bad";
}

export function fmtKpi(v: number | null, f: Fmt): string {
  if (v == null || Number.isNaN(v)) return "—";
  switch (f) {
    case "money": return Math.abs(v) >= 10000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v).toLocaleString()}`;
    case "money2": return `$${v.toFixed(2)}`;
    case "pct": return `${(v * 100).toFixed(0)}%`;
    case "pct1": return `${(v * 100).toFixed(1)}%`;
    case "x": return `${v.toFixed(2)}×`;
    case "num1": return v.toFixed(1);
    case "mins": return v >= 90 ? `${(v / 60).toFixed(1)} h` : `${Math.round(v)} min`;
    default: return Math.round(v).toLocaleString();
  }
}

/** Targets are typed in display units (percent as 12, not 0.12) and stored as the raw value. */
export const targetToDisplay = (v: number, f: Fmt) => (f === "pct" || f === "pct1" ? Math.round(v * 1000) / 10 : v);
export const targetFromDisplay = (v: number, f: Fmt) => (f === "pct" || f === "pct1" ? v / 100 : v);
