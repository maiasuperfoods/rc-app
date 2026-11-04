import type { BrandBook, CostInputs, DailyBusinessMetrics, DailySupportMetrics, Flag, Tenant, WbrMetrics } from "@/lib/types";

export function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - day + 1);
  return x;
}
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function rollupWeek(
  daily: DailyBusinessMetrics[],
  support: DailySupportMetrics[],
  costs: CostInputs,
  weekStart: string,
  weekEnd: string,
  extras?: { upsellTakeRate?: number | null; subscriptionActive?: number | null; subscriptionChurn?: number | null },
): WbrMetrics {
  const inWeek = (d: { date: string }) => d.date >= weekStart && d.date <= weekEnd;
  const rows = daily.filter(inWeek);
  const sum = (f: (r: DailyBusinessMetrics) => number) => rows.reduce((a, r) => a + f(r), 0);
  const revenue = sum((r) => r.revenue);
  const orders = sum((r) => r.orders);
  const adSpend = sum((r) => r.adSpend);
  const newCustomers = sum((r) => r.newCustomers);
  const refunds = sum((r) => r.refunds);
  const cogs = sum((r) => r.cogs);
  const fulfillment = orders * (costs.outboundShippingPerOrder + costs.fulfillmentPerOrder);
  const processing = revenue * costs.processingRate + orders * costs.processingFixed;
  const contributionMargin = revenue - cogs - fulfillment - processing - refunds - adSpend;
  const tickets = support.filter(inWeek).reduce((a, r) => a + r.tickets, 0);
  return {
    revenue,
    orders,
    aov: orders > 0 ? revenue / orders : 0,
    adSpend,
    blendedRoas: adSpend > 0 ? revenue / adSpend : 0,
    newCustomers,
    ncpa: newCustomers > 0 ? adSpend / newCustomers : 0,
    contributionMargin,
    contributionMarginPct: revenue > 0 ? contributionMargin / revenue : 0,
    refundRate: revenue > 0 ? refunds / revenue : 0,
    upsellTakeRate: extras?.upsellTakeRate ?? null,
    subscriptionActive: extras?.subscriptionActive ?? null,
    subscriptionChurn: extras?.subscriptionChurn ?? null,
    ticketsPerHundredOrders: orders > 0 && support.length ? (tickets / orders) * 100 : null,
  };
}

export function pctChange(now: number, prev: number): number | null {
  if (!prev) return null;
  return (now - prev) / prev;
}

/**
 * Deterministic commentary. Used when no LLM key is configured and as the
 * grounding facts handed to the LLM when it is. Never invents a number.
 */
export function templateCommentary(tenant: Tenant, m: WbrMetrics, p: WbrMetrics, allowableNcpa: number | null, flags: Flag[]): string {
  const f = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const d = (n: number | null) => (n == null ? "" : ` (${n >= 0 ? "+" : ""}${Math.round(n * 100)}% vs last week)`);
  const lines: string[] = [];
  lines.push(`${tenant.name} did ${f(m.revenue)} in revenue${d(pctChange(m.revenue, p.revenue))} on ${f(m.adSpend)} of ad spend, a blended ROAS of ${m.blendedRoas.toFixed(2)}.`);
  if (allowableNcpa != null) {
    const over = m.ncpa > allowableNcpa;
    lines.push(`New customers cost ${f(m.ncpa)} each${d(pctChange(m.ncpa, p.ncpa))}, which is ${over ? "above" : "within"} the allowable ${f(allowableNcpa)} from Unit Economics.${over ? " Every new customer this week was bought at a loss on first order; the week only works if repeat purchase and upsells close the gap." : ""}`);
  } else {
    lines.push(`New customers cost ${f(m.ncpa)} each${d(pctChange(m.ncpa, p.ncpa))}. Set up Unit Economics to see whether that is inside your allowable NCPA.`);
  }
  lines.push(`Contribution margin after ads was ${f(m.contributionMargin)} (${Math.round(m.contributionMarginPct * 100)}% of revenue)${d(pctChange(m.contributionMargin, p.contributionMargin))}. AOV ${f(m.aov)}${d(pctChange(m.aov, p.aov))}.`);
  if (m.refundRate > 0.05) lines.push(`Refund rate is ${(m.refundRate * 100).toFixed(1)}%, above the 5% comfort line. Check Commslayer refund reasons before scaling.`);
  const red = flags.filter((x) => x.severity === "red");
  if (red.length) lines.push(`Red flags this week: ${red.map((x) => x.message).join("; ")}.`);
  lines.push(`Stage: ${tenant.stage}. Next: ${nextAction(tenant.stage, m, allowableNcpa)}`);
  return lines.join("\n\n");
}

function nextAction(stage: Tenant["stage"], m: WbrMetrics, allowable: number | null): string {
  if (allowable != null && m.ncpa > allowable) return "do not add spend; launch iterations of the current winners to pull NCPA down before scaling.";
  switch (stage) {
    case "grind":
      return "get to a repeatable winning ad before touching anything else — ship creative every week.";
    case "validation":
      return "prove the offer at 3+ consecutive weeks of positive contribution, then add spend in 20% steps.";
    case "acceleration":
      return "scale spend while NCPA stays inside allowable; add an upsell to raise AOV.";
    case "expansion":
      return "diversify angles and avatars so one fatigued concept cannot sink the month.";
  }
}

export function computeFlags(args: {
  tenant: Tenant;
  m: WbrMetrics | null;
  allowableNcpa: number | null;
  worstGrossMarginPct: number | null;
  ruleThreshold: number;
  chargebackRate: number | null;
  opexMonthly: number;
  monthlyRevenue: number;
  nextStockout: { sku: string; date: string; reorderBy: string | null } | null;
  syncErrors: string[];
}): Flag[] {
  const flags: Flag[] = [];
  const t = args.tenant.id;
  if (args.worstGrossMarginPct != null && args.worstGrossMarginPct < args.ruleThreshold)
    flags.push({ tenantId: t, severity: "red", code: "margin_below_rule", message: `An offer is below the ${Math.round(args.ruleThreshold * 100)}% margin rule (${Math.round(args.worstGrossMarginPct * 100)}%)`, value: args.worstGrossMarginPct, threshold: args.ruleThreshold });
  if (args.m && args.allowableNcpa != null && args.m.ncpa > args.allowableNcpa)
    flags.push({ tenantId: t, severity: args.m.ncpa > args.allowableNcpa * 1.25 ? "red" : "amber", code: "ncpa_above_allowable", message: `NCPA $${Math.round(args.m.ncpa)} is above allowable $${Math.round(args.allowableNcpa)}`, value: args.m.ncpa, threshold: args.allowableNcpa });
  if (args.chargebackRate != null && args.chargebackRate > 0.005)
    flags.push({ tenantId: t, severity: "red", code: "chargeback_rate", message: `Chargeback rate ${(args.chargebackRate * 100).toFixed(2)}% is above 0.5%`, value: args.chargebackRate, threshold: 0.005 });
  if (args.monthlyRevenue > 0 && args.opexMonthly / args.monthlyRevenue > 0.07)
    flags.push({ tenantId: t, severity: "amber", code: "opex_ratio", message: `Opex is ${Math.round((args.opexMonthly / args.monthlyRevenue) * 100)}% of revenue (target ≤ 7%)`, value: args.opexMonthly / args.monthlyRevenue, threshold: 0.07 });
  if (args.nextStockout) {
    const overdue = args.nextStockout.reorderBy ? new Date(args.nextStockout.reorderBy) < new Date() : false;
    flags.push({ tenantId: t, severity: overdue ? "red" : "amber", code: "stockout", message: `${args.nextStockout.sku} runs out ${args.nextStockout.date}${overdue ? " and the reorder date has passed" : ""}`, value: null, threshold: null });
  }
  for (const e of args.syncErrors) flags.push({ tenantId: t, severity: "amber", code: "sync_failed", message: e, value: null, threshold: null });
  return flags;
}
