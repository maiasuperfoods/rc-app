/**
 * Weekly cash-flow forecast engine.
 *
 * Mirrors the program's cash-flow model workbook, tab for tab:
 *   1. Inputs            → ForecastInputs
 *   2. Lines Weekly      → runForecast().lines[*].weeks
 *   3–5. Cohort engines  → runForecast().lines[*].cohorts (rebill matrix)
 *   6. Inventory & POs   → runForecast().pools
 *   7. Cash Flow Weekly  → runForecast().cash
 *   8. Monthly Summary   → runForecast().months
 *   9. Ramp Scenarios    → runScenarios()
 *   10. Committed POs    → ForecastInputs.committed
 *
 * Pure functions, no I/O. Weeks are ISO weeks (Monday start). Rebills run on
 * 28-day cycles (every 4 weeks). All inputs are per brand; nothing here is
 * seeded with any real brand's numbers.
 */

export interface LineInputs {
  id: string;
  name: string;
  rampStartWeek: number; // model week (1 = first week)
  dailySpendStart: number;
  dailySpendTarget1: number;
  target1Week: number;
  dailySpendTarget2: number;
  target2Week: number;
  weeklyGrowthAfter: number; // 0.02 = +2%/week after the last target
  roasStart: number; // new-customer ROAS at ramp start
  roasScale: number; // at scale
  roasScaleWeek: number;
  firstOrderAov: number; // includes upsell contribution
  upsellTakeRate: number;
  upsellPrice: number;
  upsellPoolId: string | null;
  upsellUnitsPerOrder: number;
  fulfillmentNew: number;
  fulfillmentRebill: number;
  rebillRevenue: number; // revenue per rebill order
  unitsPerNewOrder: Record<string, number>; // poolId → units
  unitsPerRebillOrder: Record<string, number>;
  /** Weekly spend overrides keyed by model week (the "type to replace" row). */
  spendOverrides: Record<number, number>;
  /** Existing weekly cohorts before the model start (oldest first), for brands already live. */
  preCohorts: { weekStart: string; newCustomers: number; regime: "old" | "new" }[];
  longTailWeekly: number; // rebill revenue from cohorts older than the preCohorts list
  longTailDecay: number; // weekly
}

export interface PoolInputs {
  id: string;
  name: string;
  onHand: number;
  landedCost: number;
  leadWeeks: number;
  scheduledInbound: { week: number; units: number }[];
}

export interface ForecastInputs {
  startDate: string; // Monday of model week 1 (ISO date)
  horizonWeeks: number;
  cashOnHand: number;
  cashBuffer: number; // "below buffer" warning line
  paypalShare: number;
  paypalReserve: number;
  reserveReleaseWeeks: number;
  payoutDelayWeeks: number;
  adSpendLagWeeks: number; // card float
  cardLimit: number;
  cardCashback: number;
  refundRate: number;
  processingRate: number;
  preCardCharges: number[]; // unpaid charges from the weeks before the model, oldest first
  fixedOpexMonthly: number;
  variableOpexRate: number; // % of ad spend
  extraStrategists: { fromWeek: number; monthly: number }[]; // cumulative additions
  cycle1Rate: number; // share of new customers rebilling at day 28
  retention: number; // cycle-to-cycle after cycle 1
  cycle1RateOld: number; // for "old" regime pre-cohorts
  retentionOld: number;
  poCadenceWeeks: number;
  safetyWeeks: number;
  depositShare: number;
  lines: LineInputs[];
  pools: PoolInputs[];
  committed: { week: number; amount: number; what: string }[];
}

export interface WeekMeta {
  idx: number; // 1-based
  isoLabel: string; // W40
  start: string;
  end: string;
  activeDays: number;
  monthShares: Record<string, number>; // "2026-10" → share of active days
}

export interface LineWeek {
  idx: number;
  dailySpendFormula: number;
  dailySpend: number;
  spend: number;
  roas: number;
  ncRevenue: number;
  newOrders: number;
  rebillModel: number;
  rebillPre: number;
  rebills: number;
  longTail: number;
  rebillRevenue: number;
  revenue: number;
  fulfillment: number;
  demand: Record<string, number>; // poolId → units
}

export interface CohortRowOut {
  weekStart: string;
  idx: number; // negative for pre-model
  newCustomers: number;
  regime: "old" | "new";
  rebills: number[]; // by model week idx-1
}

export interface PoolWeek {
  idx: number;
  demand: number;
  cumDemand: number;
  inbound: number;
  cumInbound: number;
  poUnits: number;
  closing: number;
  cashOut: number;
}

export interface CashWeek {
  idx: number;
  revenue: number;
  netReceipts: number;
  reserveHeld: number;
  reserveReleased: number;
  payouts: number;
  adCharged: number;
  cardBalance: number;
  adPaid: number;
  cashback: number;
  inventory: number;
  committed: number;
  fulfillment: number;
  fixedOpex: number;
  variableOpex: number;
  net: number;
  closing: number;
  belowBuffer: boolean;
  cardAtLimit: boolean;
  reserveOutstanding: number;
}

export interface MonthOut {
  month: string;
  days: number;
  spendByLine: Record<string, number>;
  spend: number;
  spendPerDay: number;
  newCustomersByLine: Record<string, number>;
  newCustomers: number;
  ncRevenueByLine: Record<string, number>;
  ncRoasByLine: Record<string, number>;
  ncRoas: number;
  cacByLine: Record<string, number>;
  revenueByLine: Record<string, number>;
  revenue: number;
  blendedRoas: number;
  returningShare: number;
  refundsProcessing: number;
  cogs: number;
  fulfillment: number;
  contribution: number;
  strategists: number;
  opex: number;
  operatingProfit: number;
  operatingMargin: number;
  payouts: number;
  adPaid: number;
  inventory: number;
  committed: number;
  cashOpex: number;
  cashback: number;
  netCash: number;
  cashEnd: number;
  lowestCash: number;
  cardEnd: number;
  reserveEnd: number;
}

export interface ForecastResult {
  weeks: WeekMeta[];
  lines: { id: string; name: string; weeks: LineWeek[]; cohorts: CohortRowOut[] }[];
  pools: { id: string; name: string; weeks: PoolWeek[] }[];
  cash: CashWeek[];
  months: MonthOut[];
  summary: { minCash: number; minCashWeek: string; peakCard: number; peakCardUncapped: number; cashEnd: number; cashAtWeek13: number; firstBelowBuffer: string | null };
}

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
function isoWeekLabel(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t.getTime() - y0.getTime()) / DAY + 1) / 7);
  return `W${wk}${t.getUTCFullYear() !== d.getUTCFullYear() ? `'${String(t.getUTCFullYear()).slice(2)}` : ""}`;
}
export function mondayOnOrBefore(s: string) {
  const d = new Date(s + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  return addDays(d, -(day - 1));
}

export function buildWeeks(inputs: ForecastInputs): WeekMeta[] {
  const modelStart = new Date(inputs.startDate + "T00:00:00Z");
  const monday = mondayOnOrBefore(inputs.startDate);
  const out: WeekMeta[] = [];
  for (let i = 0; i < inputs.horizonWeeks; i++) {
    const ws = addDays(monday, i * 7);
    const we = addDays(ws, 6);
    const shares: Record<string, number> = {};
    let active = 0;
    for (let d = 0; d < 7; d++) {
      const day = addDays(ws, d);
      if (day < modelStart) continue;
      active++;
      const m = iso(day).slice(0, 7);
      shares[m] = (shares[m] ?? 0) + 1;
    }
    for (const k in shares) shares[k] /= active || 1;
    out.push({ idx: i + 1, isoLabel: isoWeekLabel(ws), start: iso(ws), end: iso(we), activeDays: active, monthShares: shares });
  }
  return out;
}

function rampDaily(l: LineInputs, w: number): number {
  if (w < l.rampStartWeek) return 0;
  if (w <= l.target1Week) {
    const span = Math.max(1, l.target1Week - l.rampStartWeek);
    return l.dailySpendStart + ((l.dailySpendTarget1 - l.dailySpendStart) * (w - l.rampStartWeek)) / span;
  }
  if (w <= l.target2Week) {
    const span = Math.max(1, l.target2Week - l.target1Week);
    return l.dailySpendTarget1 + ((l.dailySpendTarget2 - l.dailySpendTarget1) * (w - l.target1Week)) / span;
  }
  return l.dailySpendTarget2 * Math.pow(1 + l.weeklyGrowthAfter, w - l.target2Week);
}
function roasAt(l: LineInputs, w: number): number {
  if (w <= l.rampStartWeek) return l.roasStart;
  if (w >= l.roasScaleWeek) return l.roasScale;
  const span = Math.max(1, l.roasScaleWeek - l.rampStartWeek);
  return l.roasStart + ((l.roasScale - l.roasStart) * (w - l.rampStartWeek)) / span;
}

export function runForecast(inputs: ForecastInputs): ForecastResult {
  const weeks = buildWeeks(inputs);
  const W = weeks.length;
  const monday1 = mondayOnOrBefore(inputs.startDate);

  // ---- lines --------------------------------------------------------------
  const lines = inputs.lines.map((l) => {
    const lw: LineWeek[] = [];
    const cohorts: CohortRowOut[] = [];
    // pre-model cohorts
    const pre = [...l.preCohorts].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    for (const c of pre) {
      const idx = Math.round((new Date(c.weekStart + "T00:00:00Z").getTime() - monday1.getTime()) / (7 * DAY)) + 1;
      cohorts.push({ weekStart: c.weekStart, idx, newCustomers: c.newCustomers, regime: c.regime, rebills: new Array(W).fill(0) });
    }
    // model cohorts filled as we go
    for (let w = 1; w <= W; w++) {
      const meta = weeks[w - 1];
      const formula = rampDaily(l, w);
      const daily = l.spendOverrides[w] != null ? l.spendOverrides[w] : formula;
      const spend = daily * meta.activeDays;
      const roas = roasAt(l, w);
      const ncRevenue = spend * roas;
      const newOrders = l.firstOrderAov > 0 ? ncRevenue / l.firstOrderAov : 0;
      cohorts.push({ weekStart: meta.start, idx: w, newCustomers: newOrders, regime: "new", rebills: new Array(W).fill(0) });
      lw.push({ idx: w, dailySpendFormula: formula, dailySpend: daily, spend, roas, ncRevenue, newOrders, rebillModel: 0, rebillPre: 0, rebills: 0, longTail: 0, rebillRevenue: 0, revenue: 0, fulfillment: 0, demand: {} });
    }
    // rebill engine: cohort × week; cycle k lands exactly 4k weeks after acquisition
    for (const c of cohorts) {
      const r1 = c.regime === "old" ? inputs.cycle1RateOld : inputs.cycle1Rate;
      const ret = c.regime === "old" ? inputs.retentionOld : inputs.retention;
      for (let w = 1; w <= W; w++) {
        const gap = w - c.idx;
        if (gap <= 0 || gap % 4 !== 0) continue;
        const cycle = gap / 4;
        const n = c.newCustomers * r1 * Math.pow(ret, cycle - 1);
        c.rebills[w - 1] = n;
        const row = lw[w - 1];
        if (c.idx >= 1) row.rebillModel += n;
        else row.rebillPre += n;
      }
    }
    for (let w = 1; w <= W; w++) {
      const row = lw[w - 1];
      row.rebills = row.rebillModel + row.rebillPre;
      row.longTail = l.longTailWeekly * Math.pow(1 - l.longTailDecay, w - 1);
      row.rebillRevenue = row.rebills * l.rebillRevenue + row.longTail;
      row.revenue = row.ncRevenue + row.rebillRevenue;
      row.fulfillment = row.newOrders * l.fulfillmentNew + row.rebills * l.fulfillmentRebill;
      for (const [pool, units] of Object.entries(l.unitsPerNewOrder)) row.demand[pool] = (row.demand[pool] ?? 0) + row.newOrders * units;
      for (const [pool, units] of Object.entries(l.unitsPerRebillOrder)) row.demand[pool] = (row.demand[pool] ?? 0) + row.rebills * units;
      if (l.upsellPoolId) row.demand[l.upsellPoolId] = (row.demand[l.upsellPoolId] ?? 0) + row.newOrders * l.upsellTakeRate * l.upsellUnitsPerOrder;
    }
    return { id: l.id, name: l.name, weeks: lw, cohorts };
  });

  // ---- inventory pools ----------------------------------------------------
  const pools = inputs.pools.map((p) => {
    const pw: PoolWeek[] = [];
    let cumD = 0, cumI = 0, onHand = p.onHand;
    const landing: number[] = new Array(W + 60).fill(0); // POs landing by week idx
    const cashOut: number[] = new Array(W + 60).fill(0);
    for (let w = 1; w <= W; w++) {
      const demand = lines.reduce((a, l) => a + (l.weeks[w - 1].demand[p.id] ?? 0), 0);
      cumD += demand;
      const inbound = p.scheduledInbound.filter((s) => s.week === w).reduce((a, s) => a + s.units, 0);
      cumI += inbound;
      let poUnits = 0;
      if ((w - 1) % inputs.poCadenceWeeks === 0) {
        // cover demand until the next PO would land (lead + cadence) plus safety stock
        const coverUntil = Math.min(W, w + p.leadWeeks + inputs.poCadenceWeeks + inputs.safetyWeeks);
        let futureDemand = 0, futureInbound = 0;
        for (let k = w; k <= coverUntil; k++) {
          futureDemand += lines.reduce((a, l) => a + (l.weeks[k - 1].demand[p.id] ?? 0), 0);
          futureInbound += p.scheduledInbound.filter((s) => s.week === k).reduce((a, s) => a + s.units, 0);
        }
        const landingBefore = landing.slice(w - 1, coverUntil).reduce((a, b) => a + b, 0);
        poUnits = Math.max(0, futureDemand - (onHand + futureInbound + landingBefore));
        if (poUnits > 0) {
          landing[w - 1 + p.leadWeeks] += poUnits;
          const value = poUnits * p.landedCost;
          cashOut[w - 1] += value * inputs.depositShare;
          cashOut[w - 1 + p.leadWeeks] += value * (1 - inputs.depositShare);
        }
      }
      onHand = onHand + inbound + landing[w - 1] - demand;
      pw.push({ idx: w, demand, cumDemand: cumD, inbound, cumInbound: cumI, poUnits, closing: onHand, cashOut: cashOut[w - 1] });
    }
    return { id: p.id, name: p.name, weeks: pw };
  });

  // ---- cash flow ----------------------------------------------------------
  const cash: CashWeek[] = [];
  const lag = inputs.adSpendLagWeeks;
  const pre = inputs.preCardCharges;
  // charges: index by model week; pre-model charges sit at idx <= 0
  const charges: Record<number, number> = {};
  pre.forEach((c, i) => (charges[i - pre.length + 1] = c));
  for (let w = 1; w <= W; w++) charges[w] = lines.reduce((a, l) => a + l.weeks[w - 1].spend, 0);
  let cardBalance = 0;
  for (let i = -pre.length + 1; i <= 0; i++) cardBalance = Math.min(inputs.cardLimit, cardBalance + (charges[i] ?? 0));
  const netRate = 1 - inputs.refundRate - inputs.processingRate;
  const receiptsBy: number[] = [];
  const reserveBy: number[] = [];
  let closing = inputs.cashOnHand;
  let reserveOutstanding = 0;
  const strategistsMonthly = (w: number) => inputs.extraStrategists.filter((s) => s.fromWeek <= w).reduce((a, s) => a + s.monthly, 0);
  for (let w = 1; w <= W; w++) {
    const meta = weeks[w - 1];
    const revenue = lines.reduce((a, l) => a + l.weeks[w - 1].revenue, 0);
    const netReceipts = revenue * netRate;
    const reserveHeld = netReceipts * inputs.paypalShare * inputs.paypalReserve;
    receiptsBy[w] = netReceipts - reserveHeld;
    reserveBy[w] = reserveHeld;
    const reserveReleased = reserveBy[w - inputs.reserveReleaseWeeks] ?? 0;
    const payouts = (receiptsBy[w - inputs.payoutDelayWeeks] ?? 0) + reserveReleased;
    reserveOutstanding += reserveHeld - reserveReleased;

    const adCharged = charges[w] ?? 0;
    // the card carries charges for `lag` weeks; what falls off is paid in cash; above the limit is paid as incurred
    const dueThisWeek = charges[w - lag] ?? 0;
    const uncappedNext = cardBalance + adCharged - (lag > 0 ? dueThisWeek : adCharged);
    const nextBalance = Math.min(inputs.cardLimit, Math.max(0, uncappedNext));
    const adPaid = adCharged - (nextBalance - cardBalance);
    cardBalance = nextBalance;
    const cashback = adPaid * inputs.cardCashback;

    const inventory = pools.reduce((a, p) => a + p.weeks[w - 1].cashOut, 0);
    const committed = inputs.committed.filter((c) => c.week === w).reduce((a, c) => a + c.amount, 0);
    const fulfillment = lines.reduce((a, l) => a + l.weeks[w - 1].fulfillment, 0);
    const fixedOpex = Object.entries(meta.monthShares).reduce((a, [m, share]) => {
      const [y, mo] = m.split("-").map(Number);
      const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      return a + ((inputs.fixedOpexMonthly + strategistsMonthly(w)) / dim) * share * meta.activeDays;
    }, 0);
    const variableOpex = adCharged * inputs.variableOpexRate;
    const net = payouts + cashback - adPaid - inventory - committed - fulfillment - fixedOpex - variableOpex;
    closing += net;
    cash.push({ idx: w, revenue, netReceipts, reserveHeld, reserveReleased, payouts, adCharged, cardBalance, adPaid, cashback, inventory, committed, fulfillment, fixedOpex, variableOpex, net, closing, belowBuffer: closing < inputs.cashBuffer, cardAtLimit: cardBalance >= inputs.cardLimit - 1, reserveOutstanding });
  }

  // ---- monthly summary -----------------------------------------------------
  const monthKeys = [...new Set(weeks.flatMap((w) => Object.keys(w.monthShares)))].sort();
  const months: MonthOut[] = monthKeys.map((m) => {
    const [y, mo] = m.split("-").map(Number);
    const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const sh = (w: number) => weeks[w - 1].monthShares[m] ?? 0;
    const sumW = (f: (w: number) => number) => weeks.reduce((a, wk) => a + f(wk.idx) * sh(wk.idx), 0);
    const spendByLine: Record<string, number> = {}, ncByLine: Record<string, number> = {}, ncRevByLine: Record<string, number> = {}, revByLine: Record<string, number> = {};
    let cogs = 0;
    for (const l of lines) {
      spendByLine[l.id] = sumW((w) => l.weeks[w - 1].spend);
      ncByLine[l.id] = sumW((w) => l.weeks[w - 1].newOrders);
      ncRevByLine[l.id] = sumW((w) => l.weeks[w - 1].ncRevenue);
      revByLine[l.id] = sumW((w) => l.weeks[w - 1].revenue);
    }
    for (const p of pools) {
      const pi = inputs.pools.find((x) => x.id === p.id)!;
      cogs += sumW((w) => p.weeks[w - 1].demand) * pi.landedCost;
    }
    const spend = Object.values(spendByLine).reduce((a, b) => a + b, 0);
    const newCustomers = Object.values(ncByLine).reduce((a, b) => a + b, 0);
    const ncRevenue = Object.values(ncRevByLine).reduce((a, b) => a + b, 0);
    const revenue = Object.values(revByLine).reduce((a, b) => a + b, 0);
    const refundsProcessing = revenue * (inputs.refundRate + inputs.processingRate);
    const fulfillment = sumW((w) => cash[w - 1].fulfillment);
    const contribution = revenue - refundsProcessing - cogs - fulfillment - spend;
    const strategists = weeks.filter((w) => sh(w.idx) > 0).reduce((a, w) => Math.max(a, strategistsMonthly(w.idx)), 0);
    const coveredDays = weeks.reduce((a, wk) => a + sh(wk.idx) * wk.activeDays, 0);
    const opex = (inputs.fixedOpexMonthly + strategists) * (coveredDays / days) + spend * inputs.variableOpexRate;
    const operatingProfit = contribution - opex;
    const inMonth = cash.filter((c) => sh(c.idx) > 0);
    const last = inMonth[inMonth.length - 1];
    const ncRoasByLine: Record<string, number> = {}, cacByLine: Record<string, number> = {};
    for (const l of lines) {
      ncRoasByLine[l.id] = spendByLine[l.id] ? ncRevByLine[l.id] / spendByLine[l.id] : 0;
      cacByLine[l.id] = ncByLine[l.id] ? spendByLine[l.id] / ncByLine[l.id] : 0;
    }
    return {
      month: m, days, spendByLine, spend, spendPerDay: spend / days, newCustomersByLine: ncByLine, newCustomers, ncRevenueByLine: ncRevByLine, ncRoasByLine, ncRoas: spend ? ncRevenue / spend : 0, cacByLine, revenueByLine: revByLine, revenue,
      blendedRoas: spend ? revenue / spend : 0, returningShare: revenue ? (revenue - ncRevenue) / revenue : 0, refundsProcessing, cogs, fulfillment, contribution, strategists, opex, operatingProfit, operatingMargin: revenue ? operatingProfit / revenue : 0,
      payouts: sumW((w) => cash[w - 1].payouts), adPaid: sumW((w) => cash[w - 1].adPaid), inventory: sumW((w) => cash[w - 1].inventory), committed: sumW((w) => cash[w - 1].committed), cashOpex: sumW((w) => cash[w - 1].fixedOpex + cash[w - 1].variableOpex), cashback: sumW((w) => cash[w - 1].cashback),
      netCash: sumW((w) => cash[w - 1].net), cashEnd: last?.closing ?? inputs.cashOnHand, lowestCash: inMonth.length ? Math.min(...inMonth.map((c) => c.closing)) : inputs.cashOnHand, cardEnd: last?.cardBalance ?? 0, reserveEnd: last?.reserveOutstanding ?? 0,
    };
  });

  const minIdx = cash.reduce((best, c) => (c.closing < cash[best].closing ? c.idx - 1 : best), 0);
  const uncappedPeak = (() => {
    let bal = 0, peak = 0;
    const all = Object.keys(charges).map(Number).sort((a, b) => a - b);
    for (const k of all) {
      bal += charges[k];
      if (lag > 0) bal -= charges[k - lag] ?? 0;
      else bal = 0;
      peak = Math.max(peak, bal);
    }
    return peak;
  })();
  const firstBelow = cash.find((c) => c.belowBuffer);
  return {
    weeks, lines, pools, cash, months,
    summary: { minCash: cash[minIdx]?.closing ?? inputs.cashOnHand, minCashWeek: weeks[minIdx]?.start ?? inputs.startDate, peakCard: Math.max(0, ...cash.map((c) => c.cardBalance)), peakCardUncapped: uncappedPeak, cashEnd: cash[cash.length - 1]?.closing ?? inputs.cashOnHand, cashAtWeek13: cash[Math.min(12, cash.length - 1)]?.closing ?? inputs.cashOnHand, firstBelowBuffer: firstBelow ? weeks[firstBelow.idx - 1].start : null },
  };
}

// ---- scenarios -----------------------------------------------------------

export interface ScenarioResult {
  label: string;
  payment: string;
  minCash: number;
  minCashWeek: string;
  cashEnd: number;
  cashWeek13: number;
}

/**
 * Re-runs the whole model under lever changes: when the main line reaches its
 * second target, at what ROAS, and under which card arrangement.
 */
export function runScenarios(base: ForecastInputs, lineId: string): { reach: ScenarioResult[][]; reachLabels: string[]; roasLabels: string[] } {
  const line = base.lines.find((l) => l.id === lineId) ?? base.lines[0];
  if (!line) return { reach: [], reachLabels: [], roasLabels: [] };
  const baseWeek = line.target2Week;
  const reachWeeks = [Math.max(line.target1Week, baseWeek - 4), baseWeek - 2, baseWeek, baseWeek + 4, baseWeek + 8].filter((w, i, a) => w > line.target1Week - 1 && a.indexOf(w) === i);
  const roasList = [line.roasScale, +(line.roasScale + 0.1).toFixed(2), +(line.roasScale + 0.2).toFixed(2)];
  const limit = base.cardLimit > 0 ? base.cardLimit : line.dailySpendTarget2 * 7 * 4; // no card today → assume a month of spend as the limit
  const payments: { label: string; lag: number; limit: number }[] = [
    { label: "pay as you go", lag: 0, limit: 0 },
    { label: `card, ${fmtShort(limit)} limit`, lag: base.adSpendLagWeeks || 5, limit },
    { label: `card, ${fmtShort(limit * 2.5)} limit`, lag: base.adSpendLagWeeks || 5, limit: limit * 2.5 },
  ];
  const weeksMeta = buildWeeks(base);
  const reach = reachWeeks.map((rw) =>
    roasList.flatMap((roas) =>
      payments.map((p) => {
        const inp: ForecastInputs = structuredClone(base);
        inp.adSpendLagWeeks = p.lag;
        inp.cardLimit = p.limit;
        const l = inp.lines.find((x) => x.id === line.id)!;
        l.target2Week = rw;
        l.roasScale = roas;
        l.roasStart = Math.min(l.roasStart, roas);
        const r = runForecast(inp);
        return { label: `${weeksMeta[rw - 1]?.isoLabel ?? `week ${rw}`} · ROAS ${roas.toFixed(2)}×`, payment: p.label, minCash: r.summary.minCash, minCashWeek: r.summary.minCashWeek, cashEnd: r.summary.cashEnd, cashWeek13: r.summary.cashAtWeek13 };
      }),
    ),
  );
  return { reach, reachLabels: reachWeeks.map((w) => weeksMeta[w - 1]?.isoLabel ?? `week ${w}`), roasLabels: roasList.map((r) => `${r.toFixed(2)}×`) };
}

function fmtShort(n: number) {
  return n >= 1e6 ? `$${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : `$${Math.round(n / 1000)}K`;
}

/** A blank, sensible starting point for a new brand (invented defaults, no real brand's numbers). */
export function defaultForecastInputs(startDate: string): ForecastInputs {
  return {
    startDate,
    horizonWeeks: 39,
    cashOnHand: 90000,
    cashBuffer: 25000,
    paypalShare: 0.2,
    paypalReserve: 0.2,
    reserveReleaseWeeks: 9,
    payoutDelayWeeks: 0,
    adSpendLagWeeks: 0,
    cardLimit: 0,
    cardCashback: 0,
    refundRate: 0.03,
    processingRate: 0.035,
    preCardCharges: [],
    fixedOpexMonthly: 10000,
    variableOpexRate: 0.05,
    extraStrategists: [],
    cycle1Rate: 0.45,
    retention: 0.7,
    cycle1RateOld: 0.15,
    retentionOld: 0.9,
    poCadenceWeeks: 4,
    safetyWeeks: 2,
    depositShare: 0.3,
    lines: [
      {
        id: "line-1", name: "Core product", rampStartWeek: 1, dailySpendStart: 1500, dailySpendTarget1: 3000, target1Week: 5, dailySpendTarget2: 5000, target2Week: 12, weeklyGrowthAfter: 0,
        roasStart: 1.35, roasScale: 1.2, roasScaleWeek: 5, firstOrderAov: 89, upsellTakeRate: 0.22, upsellPrice: 29, upsellPoolId: "pool-upsell", upsellUnitsPerOrder: 1,
        fulfillmentNew: 8, fulfillmentRebill: 6.5, rebillRevenue: 79, unitsPerNewOrder: { "pool-core": 4 }, unitsPerRebillOrder: { "pool-core": 2 }, spendOverrides: {}, preCohorts: [], longTailWeekly: 0, longTailDecay: 0.02,
      },
    ],
    pools: [
      { id: "pool-core", name: "Core product units", onHand: 4200, landedCost: 3.4, leadWeeks: 5, scheduledInbound: [{ week: 6, units: 10000 }] },
      { id: "pool-upsell", name: "Upsell units", onHand: 1200, landedCost: 4.2, leadWeeks: 4, scheduledInbound: [] },
    ],
    committed: [],
  };
}
