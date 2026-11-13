/**
 * What the forecast can read from connected data instead of asking the student to type it.
 *
 * Each value carries where it came from. A null means nothing connected can supply it, and the
 * Forecast shows that field as one the student has to fill in. Nothing here is estimated beyond
 * what its label says.
 *
 * Pure functions, no I/O.
 */
import type { CohortRow, CostInputs, DailyBusinessMetrics, InventoryPosition, Offer, OpexLine, Sku, Supplier } from "@/lib/types";
import type { ForecastInputs, PoolInputs } from "@/lib/calc/forecast";

export interface Sourced<T> { value: T; source: string }

export interface ForecastActuals {
  /** Days of order data the averages are built on (up to 28). 0 = no store data yet. */
  days: number;
  dailySpend: Sourced<number> | null;
  ncRoas: Sourced<number> | null;
  aov: Sourced<number> | null;
  refundRate: Sourced<number> | null;
  processingRate: Sourced<number> | null;
  fulfillmentPerOrder: Sourced<number> | null;
  fixedOpexMonthly: Sourced<number> | null;
  repeatRate: Sourced<number> | null;
  pools: Sourced<PoolInputs[]> | null;
  /** Whether every pool's lead time came from a supplier record (otherwise it is a placeholder to fill in). */
  leadTimeKnown: boolean;
  unitsPerOrder: Sourced<number> | null;
  /** New customers by week for the eight weeks before the model starts, oldest first. */
  preCohorts: { weekStart: string; newCustomers: number }[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

export function buildForecastActuals(a: {
  daily: DailyBusinessMetrics[];
  cohorts: CohortRow[];
  costs: CostInputs | null;
  /** Whether the student has saved their own Unit Economics; defaults are not "their data". */
  costsAreSaved: boolean;
  opex: OpexLine[];
  skus: Sku[];
  inventory: InventoryPosition[];
  suppliers: Supplier[];
  offers: Offer[];
  modelStart: string;
  today?: Date;
}): ForecastActuals {
  const today = a.today ?? new Date();
  const from = iso(new Date(today.getTime() - 27 * 86400000));
  const rows = a.daily.filter((d) => d.date >= from);
  const sum = (f: (r: DailyBusinessMetrics) => number) => rows.reduce((t, r) => t + f(r), 0);
  const days = rows.length;
  const revenue = sum((r) => r.revenue), orders = sum((r) => r.orders), spend = sum((r) => r.adSpend), nc = sum((r) => r.newCustomers), refunds = sum((r) => r.refunds);
  const win = `last ${days} days`;
  // NC-ROAS is Triple Whale's own new-customer revenue over ad spend, on the days it reported one. It is never estimated.
  const ncRows = rows.filter((r) => r.newCustomerRevenue != null);
  const ncRev = ncRows.reduce((t, r) => t + (r.newCustomerRevenue ?? 0), 0), ncSpend = ncRows.reduce((t, r) => t + r.adSpend, 0);
  const aov = orders > 0 ? revenue / orders : null;

  // Inventory pools: one per SKU that Shopify holds stock for, biggest first.
  const posBySku = new Map(a.inventory.map((p) => [p.skuId, p]));
  const supBySku = new Map(a.suppliers.map((s) => [s.skuId, s]));
  const stocked = a.skus.filter((s) => posBySku.has(s.id)).sort((x, y) => (posBySku.get(y.id)!.dailyVelocity30 - posBySku.get(x.id)!.dailyVelocity30) || (posBySku.get(y.id)!.onHand - posBySku.get(x.id)!.onHand)).slice(0, 4);
  const pools: PoolInputs[] = stocked.map((s) => {
    const pos = posBySku.get(s.id)!;
    const sup = supBySku.get(s.id);
    const startMs = +new Date(a.modelStart + "T00:00:00Z");
    return {
      id: `pool-${s.id}`,
      name: s.variantTitle || s.sku,
      onHand: Math.max(0, Math.round(pos.onHand)),
      landedCost: s.landedCost,
      leadWeeks: sup ? Math.max(1, Math.round(sup.leadTimeDays / 7)) : 6,
      scheduledInbound: pos.inbound.map((i) => ({ week: Math.max(1, Math.floor((+new Date(i.eta + "T00:00:00Z") - startMs) / (7 * 86400000)) + 1), units: i.quantity })).filter((i) => i.units > 0),
    };
  });

  const defaultOffer = a.offers.find((o) => o.isDefault) ?? a.offers[0] ?? null;
  const cohort = a.cohorts[a.cohorts.length - 1] ?? null;
  const opexTotal = a.opex.reduce((t, o) => t + o.monthly, 0);

  const preCohorts: ForecastActuals["preCohorts"] = [];
  for (let i = 8; i >= 1; i--) {
    const ws = addDays(a.modelStart, -7 * i), we = addDays(ws, 6);
    const n = a.daily.filter((d) => d.date >= ws && d.date <= we).reduce((t, d) => t + d.newCustomers, 0);
    if (n > 0) preCohorts.push({ weekStart: ws, newCustomers: Math.round(n) });
  }

  return {
    days,
    dailySpend: days && spend > 0 ? { value: Math.round(spend / days), source: `Triple Whale · ${win}` } : null,
    ncRoas: ncSpend > 0 && ncRev > 0 ? { value: Math.round((ncRev / ncSpend) * 100) / 100, source: `Triple Whale · ${win}` } : null,
    aov: aov ? { value: Math.round(aov * 100) / 100, source: `Shopify · ${win}` } : null,
    refundRate: revenue > 0 ? { value: Math.round((refunds / revenue) * 1000) / 1000, source: `Shopify · ${win}` } : null,
    processingRate: a.costs && a.costsAreSaved ? { value: a.costs.processingRate + a.costs.chargebackRate, source: "your Unit Economics" } : null,
    fulfillmentPerOrder: a.costs && a.costsAreSaved ? { value: Math.round((a.costs.outboundShippingPerOrder + a.costs.fulfillmentPerOrder) * 100) / 100, source: "your Unit Economics" } : null,
    fixedOpexMonthly: opexTotal > 0 ? { value: Math.round(opexTotal), source: "your Unit Economics" } : null,
    repeatRate: cohort && cohort.repurchaseRate > 0 ? { value: cohort.repurchaseRate, source: `Lifetimely · ${cohort.cohortMonth} cohort` } : null,
    pools: pools.length ? { value: pools, source: "Shopify inventory" } : null,
    leadTimeKnown: pools.length > 0 && stocked.every((s) => supBySku.has(s.id)),
    unitsPerOrder: defaultOffer ? { value: defaultOffer.unitsShipped, source: `your default offer, ${defaultOffer.name}` } : null,
    preCohorts,
  };
}

/**
 * Writes everything the store can supply into a set of forecast inputs, leaving the fields only
 * the student knows (cash, where they want spend to go, by when) untouched.
 */
export function applyActuals(inp: ForecastInputs, a: ForecastActuals, opts: { seedTargets?: boolean } = {}): ForecastInputs {
  const out: ForecastInputs = structuredClone(inp);
  const line = out.lines[0];
  if (!line) return out;
  if (a.refundRate) out.refundRate = a.refundRate.value;
  if (a.processingRate) out.processingRate = a.processingRate.value;
  if (a.fixedOpexMonthly) out.fixedOpexMonthly = a.fixedOpexMonthly.value;
  if (a.repeatRate) out.cycle1Rate = a.repeatRate.value;
  if (a.dailySpend) {
    line.dailySpendStart = a.dailySpend.value;
    if (opts.seedTargets) {
      // A starting suggestion only: half as much again in six weeks. The student sets the real one.
      const target = Math.max(50, Math.round((a.dailySpend.value * 1.5) / 50) * 50);
      line.dailySpendTarget1 = target; line.target1Week = 6;
      line.dailySpendTarget2 = target; line.target2Week = 7;
    }
  }
  if (a.ncRoas) {
    line.roasStart = a.ncRoas.value;
    // The target is the student's call. A first forecast starts it level with today so the plan is not flattered.
    if (opts.seedTargets) { line.roasScale = a.ncRoas.value; line.roasScaleWeek = line.target1Week; }
  }
  if (a.aov) { line.firstOrderAov = a.aov.value; line.rebillRevenue = a.aov.value; }
  if (a.fulfillmentPerOrder) { line.fulfillmentNew = a.fulfillmentPerOrder.value; line.fulfillmentRebill = a.fulfillmentPerOrder.value; }
  if (a.pools) {
    out.pools = structuredClone(a.pools.value);
    const main = out.pools[0].id;
    const units = a.unitsPerOrder?.value ?? 1;
    for (const l of out.lines) {
      l.unitsPerNewOrder = { [main]: units };
      l.unitsPerRebillOrder = { [main]: units };
      // The upsell assumptions belonged to the placeholder pools; a student adds theirs under All inputs.
      l.upsellPoolId = null;
      l.upsellTakeRate = 0;
    }
  }
  if (a.preCohorts.length) line.preCohorts = a.preCohorts.map((c) => ({ ...c, regime: "new" as const }));
  return out;
}
