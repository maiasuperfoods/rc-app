import type { InventoryPosition, Sku, SpendPlan, Supplier } from "@/lib/types";

export interface SkuForecast {
  skuId: string;
  skuCode: string;
  variantTitle: string;
  onHand: number;
  inboundTotal: number;
  dailyVelocity: number; // adjusted for the spend plan
  baseVelocity: number; // last-30-day actual
  spendMultiplier: number;
  daysOfCover: number | null; // on hand + inbound arriving before stock-out
  stockoutDate: string | null;
  reorderByDate: string | null; // stockout − lead time − 14 day safety
  reorderStatus: "ok" | "soon" | "overdue" | "unknown";
  suggestedPoQty: number;
  cashTiedUp: number; // on-hand × landed cost
  leadTimeDays: number;
  moq: number;
  weekly: { week: string; projectedUnits: number; endingOnHand: number }[];
}

const SAFETY_DAYS = 14;
const COVER_TARGET_DAYS = 90; // the PO should cover lead time + 90 days of sales

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Demand forecast per SKU. Velocity is last-30-day sales scaled by the ratio of
 * planned ad spend to current ad spend (spend drives demand for paid-first
 * brands). Inbound POs are drawn down on their ETA.
 */
export function forecastSku(args: {
  sku: Sku;
  position: InventoryPosition;
  supplier: Supplier | null;
  spendPlan: SpendPlan;
  currentMonthlySpend: number;
  today?: Date;
  horizonWeeks?: number;
}): SkuForecast {
  const today = args.today ?? new Date();
  const horizonWeeks = args.horizonWeeks ?? 16;
  const leadTimeDays = args.supplier?.leadTimeDays ?? 30;
  const moq = args.supplier?.moq ?? 0;

  const plannedAvg =
    args.spendPlan.months.length > 0
      ? args.spendPlan.months.reduce((a, m) => a + m.spend, 0) / args.spendPlan.months.length
      : args.currentMonthlySpend;
  const spendMultiplier = args.currentMonthlySpend > 0 ? plannedAvg / args.currentMonthlySpend : 1;
  const baseVelocity = args.position.dailyVelocity30;
  const dailyVelocity = baseVelocity * spendMultiplier;

  const inbound = [...args.position.inbound].sort((a, b) => a.eta.localeCompare(b.eta));
  const inboundTotal = inbound.reduce((a, i) => a + i.quantity, 0);

  // Walk day by day until stock hits zero.
  let onHand = args.position.onHand;
  let stockoutDate: string | null = null;
  let day = 0;
  const maxDays = horizonWeeks * 7;
  const weekly: SkuForecast["weekly"] = [];
  let weekUnits = 0;
  if (dailyVelocity > 0) {
    while (day < maxDays) {
      const date = iso(addDays(today, day));
      for (const po of inbound) if (po.eta === date) onHand += po.quantity;
      onHand -= dailyVelocity;
      weekUnits += dailyVelocity;
      if (onHand <= 0 && !stockoutDate) stockoutDate = date;
      day += 1;
      if (day % 7 === 0) {
        weekly.push({ week: iso(addDays(today, day - 7)), projectedUnits: Math.round(weekUnits), endingOnHand: Math.max(0, Math.round(onHand)) });
        weekUnits = 0;
      }
    }
  }

  const daysOfCover = dailyVelocity > 0 && stockoutDate ? Math.round((new Date(stockoutDate).getTime() - today.getTime()) / 86400000) : dailyVelocity > 0 ? maxDays : null;
  const reorderBy = stockoutDate ? addDays(new Date(stockoutDate), -(leadTimeDays + SAFETY_DAYS)) : null;
  const reorderByDate = reorderBy ? iso(reorderBy) : null;
  let reorderStatus: SkuForecast["reorderStatus"] = "unknown";
  if (dailyVelocity > 0) {
    if (!reorderBy) reorderStatus = "ok";
    else if (reorderBy.getTime() < today.getTime()) reorderStatus = "overdue";
    else if (reorderBy.getTime() < addDays(today, 21).getTime()) reorderStatus = "soon";
    else reorderStatus = "ok";
  }

  const needed = dailyVelocity * (leadTimeDays + COVER_TARGET_DAYS) - args.position.onHand - inboundTotal;
  const suggestedPoQty = Math.max(0, Math.max(moq, Math.ceil(needed / 100) * 100));

  return {
    skuId: args.sku.id,
    skuCode: args.sku.sku,
    variantTitle: args.sku.variantTitle,
    onHand: args.position.onHand,
    inboundTotal,
    dailyVelocity,
    baseVelocity,
    spendMultiplier,
    daysOfCover,
    stockoutDate,
    reorderByDate,
    reorderStatus,
    suggestedPoQty: needed > 0 ? suggestedPoQty : 0,
    cashTiedUp: args.position.onHand * args.sku.landedCost,
    leadTimeDays,
    moq,
    weekly,
  };
}
