import type { CostInputs, Offer, OpexLine, Sku, Upsell } from "@/lib/types";

/**
 * Unit economics for one offer. Every line is a plain number so the UI can
 * show the formula next to the result (the student should never trust a
 * number they cannot trace).
 */
export interface OfferEconomics {
  offerId: string;
  offerName: string;
  price: number;
  unitsShipped: number;
  landedCogs: number;
  grossMargin: number;
  grossMarginPct: number; // (price - landedCogs) / price  — the 85% rule tests this
  passesRule: boolean;
  fulfillment: number; // outbound shipping + pick/pack + packaging
  processing: number;
  refundsAndChargebacks: number;
  buffer: number;
  upsellContribution: number; // expected contribution from post-purchase upsells
  contributionBeforeAds: number; // what is left to pay for the customer
  contributionBeforeAdsPct: number;
  breakEvenCac: number; // spend this much and you make nothing
  allowableCac: number; // spend this much and keep the target net margin
  targetNetMarginPct: number;
}

export interface UnitEconomicsSummary {
  offers: OfferEconomics[];
  blended: {
    aov: number;
    contributionBeforeAds: number;
    allowableCac: number;
    breakEvenCac: number;
  } | null;
  opexMonthly: number;
}

export function computeOfferEconomics(
  offer: Offer,
  sku: Sku,
  costs: CostInputs,
  upsells: Upsell[],
  targetNetMarginPct = 0.2,
): OfferEconomics {
  const price = offer.price;
  const landedCogs = offer.unitsShipped * sku.landedCost;
  const grossMargin = price - landedCogs;
  const grossMarginPct = price > 0 ? grossMargin / price : 0;
  const fulfillment =
    costs.outboundShippingPerOrder + costs.fulfillmentPerOrder + offer.unitsShipped * costs.fulfillmentPerUnit;
  const processing = price * costs.processingRate + costs.processingFixed;
  const refundsAndChargebacks = price * (costs.refundRate + costs.chargebackRate);
  const buffer = price * costs.bufferRate;
  const upsellContribution = upsells.reduce((acc, u) => acc + u.takeRate * (u.price - u.cogs), 0);
  const contributionBeforeAds =
    grossMargin - fulfillment - processing - refundsAndChargebacks - buffer + upsellContribution;
  const breakEvenCac = Math.max(0, contributionBeforeAds);
  const allowableCac = Math.max(0, contributionBeforeAds - price * targetNetMarginPct);
  return {
    offerId: offer.id,
    offerName: offer.name,
    price,
    unitsShipped: offer.unitsShipped,
    landedCogs,
    grossMargin,
    grossMarginPct,
    passesRule: grossMarginPct >= costs.targetMarginRule,
    fulfillment,
    processing,
    refundsAndChargebacks,
    buffer,
    upsellContribution,
    contributionBeforeAds,
    contributionBeforeAdsPct: price > 0 ? contributionBeforeAds / price : 0,
    breakEvenCac,
    allowableCac,
    targetNetMarginPct,
  };
}

export function computeUnitEconomics(args: {
  offers: Offer[];
  skus: Sku[];
  costs: CostInputs;
  upsells: Upsell[];
  opex: OpexLine[];
  /** Share of orders per offer id; if absent, offers are weighted equally. */
  offerMix?: Record<string, number>;
  targetNetMarginPct?: number;
}): UnitEconomicsSummary {
  const skuById = new Map(args.skus.map((s) => [s.id, s]));
  const offers = args.offers
    .map((o) => {
      const sku = skuById.get(o.skuId);
      if (!sku) return null;
      return computeOfferEconomics(o, sku, args.costs, args.upsells, args.targetNetMarginPct);
    })
    .filter((x): x is OfferEconomics => x !== null);

  let blended: UnitEconomicsSummary["blended"] = null;
  if (offers.length) {
    const weights = offers.map((o) => args.offerMix?.[o.offerId] ?? 1 / offers.length);
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    const w = weights.map((x) => x / wsum);
    const dot = (f: (o: OfferEconomics) => number) => offers.reduce((acc, o, i) => acc + f(o) * w[i], 0);
    blended = {
      aov: dot((o) => o.price),
      contributionBeforeAds: dot((o) => o.contributionBeforeAds),
      allowableCac: dot((o) => o.allowableCac),
      breakEvenCac: dot((o) => o.breakEvenCac),
    };
  }
  return {
    offers,
    blended,
    opexMonthly: args.opex.reduce((a, l) => a + l.monthly, 0),
  };
}

/** Readable explanations shown on hover in the UI. One per line item. */
export const FORMULAS: Record<string, string> = {
  landedCogs: "units shipped × landed cost per unit",
  grossMarginPct: "(price − landed COGS) ÷ price   — must clear the 85% rule",
  fulfillment: "outbound shipping + pick/pack per order + units × packaging per unit",
  processing: "price × processor rate + fixed fee",
  refundsAndChargebacks: "price × (refund rate + chargeback rate)",
  buffer: "price × slippage buffer (course: 7–10%)",
  upsellContribution: "Σ take rate × (upsell price − upsell COGS)",
  contributionBeforeAds: "gross margin − fulfillment − processing − refunds − buffer + upsells",
  breakEvenCac: "contribution before ads (spend more than this and the order loses money)",
  allowableCac: "contribution before ads − price × target net margin",
};

// ---- Cash flow -----------------------------------------------------------

export interface CashMonth {
  month: string;
  revenue: number;
  cogs: number;
  fulfillment: number;
  processing: number;
  refunds: number;
  adSpend: number;
  opex: number;
  inventoryPurchases: number;
  net: number;
  cashEnd: number;
}

export function projectCashFlow(args: {
  startingCash: number;
  months: { month: string; revenue: number; adSpend: number; inventoryPurchases?: number }[];
  costs: CostInputs;
  aov: number;
  cogsPerOrder: number;
  fulfillmentPerOrder: number;
  opexMonthly: number;
}): CashMonth[] {
  let cash = args.startingCash;
  return args.months.map((m) => {
    const orders = args.aov > 0 ? m.revenue / args.aov : 0;
    const cogs = orders * args.cogsPerOrder;
    const fulfillment = orders * args.fulfillmentPerOrder;
    const processing = m.revenue * args.costs.processingRate + orders * args.costs.processingFixed;
    const refunds = m.revenue * (args.costs.refundRate + args.costs.chargebackRate);
    const inventoryPurchases = m.inventoryPurchases ?? 0;
    const net = m.revenue - cogs - fulfillment - processing - refunds - m.adSpend - args.opexMonthly - inventoryPurchases;
    cash += net;
    return {
      month: m.month,
      revenue: m.revenue,
      cogs,
      fulfillment,
      processing,
      refunds,
      adSpend: m.adSpend,
      opex: args.opexMonthly,
      inventoryPurchases,
      net,
      cashEnd: cash,
    };
  });
}

export function runwayMonths(cash: number, monthlyNet: number): number | null {
  if (monthlyNet >= 0) return null; // not burning
  return cash / -monthlyNet;
}
