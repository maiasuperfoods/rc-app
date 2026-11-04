import type { DataSource } from "@/lib/data/source";
import { computeUnitEconomics, type UnitEconomicsSummary } from "@/lib/calc/unit-economics";
import { forecastSku, type SkuForecast } from "@/lib/calc/inventory";
import { parseConvention, summarizeCreative, type CreativeSummary } from "@/lib/calc/creative";
import { computeFlags, isoDate, mondayOf, rollupWeek, templateCommentary } from "@/lib/calc/wbr";
import type { BrandBook, CohortRow, DailyBusinessMetrics, DailySupportMetrics, Flag, IntegrationStatus, Tenant, WbrMetrics } from "@/lib/types";

export interface TenantSnapshot {
  tenant: Tenant;
  brandBook: BrandBook;
  ue: UnitEconomicsSummary;
  daily: DailyBusinessMetrics[];
  support: DailySupportMetrics[];
  cohorts: CohortRow[];
  integrations: IntegrationStatus[];
  week: { start: string; end: string; metrics: WbrMetrics; previous: WbrMetrics; prevStart: string; prevEnd: string };
  monthRevenue: number;
  monthSpend: number;
  forecasts: SkuForecast[];
  creative: CreativeSummary;
  flags: Flag[];
  commentary: string;
  chargebackRate: number | null;
}

function addDays(s: string, n: number) {
  const d = new Date(s);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** One call that assembles every number a page needs for a tenant. Cheap enough on cached snapshots; heavy queries are pre-aggregated by the workers. */
export async function buildSnapshot(db: DataSource, tenant: Tenant, today = new Date()): Promise<TenantSnapshot> {
  const from120 = isoDate(new Date(today.getTime() - 120 * 86400000));
  const from60 = isoDate(new Date(today.getTime() - 60 * 86400000));
  const [brandBook, skus, offers, costs, upsells, opex, suppliers, inventory, spendPlan, daily, support, cohorts, ads, integrations] = await Promise.all([
    db.brandBook(tenant.id),
    db.skus(tenant.id),
    db.offers(tenant.id),
    db.costInputs(tenant.id),
    db.upsells(tenant.id),
    db.opex(tenant.id),
    db.suppliers(tenant.id),
    db.inventory(tenant.id),
    db.spendPlan(tenant.id),
    db.dailyMetrics(tenant.id, from120),
    db.supportMetrics(tenant.id, from60),
    db.cohorts(tenant.id),
    db.adInsights(tenant.id, from60),
    db.integrations(tenant.id),
  ]);

  const ue = computeUnitEconomics({ offers, skus, costs, upsells, opex });

  // Last complete week (Mon–Sun) and the one before it.
  const thisMonday = mondayOf(today);
  const end = addDays(isoDate(thisMonday), -1);
  const start = addDays(end, -6);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -6);
  const metrics = rollupWeek(daily, support, costs, start, end);
  const previous = rollupWeek(daily, support, costs, prevStart, prevEnd);

  const last30 = daily.filter((d) => d.date >= isoDate(new Date(today.getTime() - 30 * 86400000)));
  const monthRevenue = last30.reduce((a, d) => a + d.revenue, 0);
  const monthSpend = last30.reduce((a, d) => a + d.adSpend, 0);

  const supplierBySku = new Map(suppliers.map((s) => [s.skuId, s]));
  const forecasts = inventory
    .map((pos) => {
      const sku = skus.find((s) => s.id === pos.skuId);
      if (!sku) return null;
      return forecastSku({ sku, position: pos, supplier: supplierBySku.get(sku.id) ?? null, spendPlan, currentMonthlySpend: monthSpend, today });
    })
    .filter((x): x is SkuForecast => x !== null);

  const creative = summarizeCreative(ads, parseConvention(brandBook.adNamingConvention), undefined, today);

  const chargebackAlerts = support.reduce((a, s) => a + s.chargebackAlerts, 0);
  const orders60 = daily.filter((d) => d.date >= from60).reduce((a, d) => a + d.orders, 0);
  const chargebackRate = support.length && orders60 ? chargebackAlerts / orders60 : null;

  const nextStock = forecasts.filter((f) => f.stockoutDate).sort((a, b) => a.stockoutDate!.localeCompare(b.stockoutDate!))[0];
  const flags = computeFlags({
    tenant,
    m: daily.length ? metrics : null,
    allowableNcpa: ue.blended?.allowableCac ?? null,
    worstGrossMarginPct: ue.offers.length ? Math.min(...ue.offers.map((o) => o.grossMarginPct)) : null,
    ruleThreshold: costs.targetMarginRule,
    chargebackRate,
    opexMonthly: ue.opexMonthly,
    monthlyRevenue: monthRevenue,
    nextStockout: nextStock && nextStock.reorderStatus !== "ok" ? { sku: nextStock.skuCode, date: nextStock.stockoutDate!, reorderBy: nextStock.reorderByDate } : null,
    syncErrors: integrations.filter((i) => i.lastError).map((i) => i.lastError!),
  });

  const commentary = templateCommentary(tenant, metrics, previous, ue.blended?.allowableCac ?? null, flags);

  return { tenant, brandBook, ue, daily, support, cohorts, integrations, week: { start, end, metrics, previous, prevStart, prevEnd }, monthRevenue, monthSpend, forecasts, creative, flags, commentary, chargebackRate };
}
