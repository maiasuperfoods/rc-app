import type { AdDailyInsight } from "@/lib/types";

/** Fields the pipe naming convention can carry. Students pick the order in the Brand Book. */
export type TaxonomyField = "angle" | "stage" | "hook" | "format" | "product" | "creator" | "avatar" | "iteration";

export const TAXONOMY_FIELDS: TaxonomyField[] = ["angle", "stage", "hook", "format", "product", "creator", "avatar", "iteration"];

/** Parse "[Angle] | [Stage] | [Hook] | [Format] | [Product] | [Creator]" into an ordered field list. */
export function parseConvention(convention: string): TaxonomyField[] {
  return convention
    .split("|")
    .map((s) => s.replace(/[\[\]]/g, "").trim().toLowerCase())
    .filter((s): s is TaxonomyField => (TAXONOMY_FIELDS as string[]).includes(s));
}

export type Taxonomy = Partial<Record<TaxonomyField, string>>;

export function parseAdName(name: string, fields: TaxonomyField[]): { taxonomy: Taxonomy; valid: boolean } {
  const parts = name.split("|").map((p) => p.trim());
  const taxonomy: Taxonomy = {};
  const valid = parts.length >= fields.length && fields.length > 0;
  if (valid) fields.forEach((f, i) => { if (parts[i]) taxonomy[f] = parts[i]; });
  return { taxonomy, valid };
}

export interface AdRollup {
  adId: string;
  adName: string;
  taxonomy: Taxonomy;
  valid: boolean;
  launchedAt: string;
  daysLive: number;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  cpa: number | null;
  ctr: number;
  cpm: number;
  thumbstopRate: number | null;
  holdRate: number | null;
  spendLast7: number;
  roasLast7: number;
  roasPrior7: number;
  status: "winner" | "testing" | "fatiguing" | "loser";
}

export interface CreativeSummary {
  ads: AdRollup[];
  hitRate: number; // winners / ads with enough spend to judge
  judged: number;
  winners: number;
  velocity: { week: string; launched: number }[];
  byField: Record<TaxonomyField, { value: string; ads: number; spend: number; purchases: number; roas: number; winners: number }[]>;
  conventionValidPct: number;
}

export interface CreativeThresholds {
  minSpendToJudge: number; // an ad under this spend is still "testing"
  winnerRoas: number; // at or above = winner
  fatigueDrop: number; // 0.3 = ROAS last 7 is 30% below prior 7
}

export const DEFAULT_THRESHOLDS: CreativeThresholds = { minSpendToJudge: 300, winnerRoas: 2.0, fatigueDrop: 0.3 };

export function summarizeCreative(
  rows: AdDailyInsight[],
  fields: TaxonomyField[],
  thresholds: CreativeThresholds = DEFAULT_THRESHOLDS,
  today: Date = new Date(),
): CreativeSummary {
  const byAd = new Map<string, AdDailyInsight[]>();
  for (const r of rows) {
    const arr = byAd.get(r.adId) ?? [];
    arr.push(r);
    byAd.set(r.adId, arr);
  }
  const todayMs = today.getTime();
  const d7 = todayMs - 7 * 86400000;
  const d14 = todayMs - 14 * 86400000;

  const ads: AdRollup[] = [];
  for (const [adId, days] of byAd) {
    const sum = (f: (d: AdDailyInsight) => number, filter?: (d: AdDailyInsight) => boolean) =>
      days.filter(filter ?? (() => true)).reduce((a, d) => a + f(d), 0);
    const spend = sum((d) => d.spend);
    const impressions = sum((d) => d.impressions);
    const clicks = sum((d) => d.clicks);
    const purchases = sum((d) => d.purchases);
    const purchaseValue = sum((d) => d.purchaseValue);
    const inLast7 = (d: AdDailyInsight) => new Date(d.date).getTime() >= d7;
    const inPrior7 = (d: AdDailyInsight) => {
      const t = new Date(d.date).getTime();
      return t >= d14 && t < d7;
    };
    const spendLast7 = sum((d) => d.spend, inLast7);
    const valLast7 = sum((d) => d.purchaseValue, inLast7);
    const spendPrior7 = sum((d) => d.spend, inPrior7);
    const valPrior7 = sum((d) => d.purchaseValue, inPrior7);
    const roasLast7 = spendLast7 > 0 ? valLast7 / spendLast7 : 0;
    const roasPrior7 = spendPrior7 > 0 ? valPrior7 / spendPrior7 : 0;
    const roas = spend > 0 ? purchaseValue / spend : 0;
    const name = days[0].adName;
    const { taxonomy, valid } = parseAdName(name, fields);
    const thumb = days.filter((d) => d.thumbstopRate != null);
    const hold = days.filter((d) => d.holdRate != null);
    const wavg = (arr: AdDailyInsight[], f: (d: AdDailyInsight) => number) => {
      const w = arr.reduce((a, d) => a + d.impressions, 0);
      return w > 0 ? arr.reduce((a, d) => a + f(d) * d.impressions, 0) / w : null;
    };

    let status: AdRollup["status"] = "testing";
    if (spend >= thresholds.minSpendToJudge) {
      if (roas >= thresholds.winnerRoas) {
        status = spendPrior7 > 0 && spendLast7 > 0 && roasLast7 < roasPrior7 * (1 - thresholds.fatigueDrop) ? "fatiguing" : "winner";
      } else status = "loser";
    }
    const launchedAt = days[0].launchedAt;
    ads.push({
      adId,
      adName: name,
      taxonomy,
      valid,
      launchedAt,
      daysLive: Math.max(1, Math.round((todayMs - new Date(launchedAt).getTime()) / 86400000)),
      spend,
      impressions,
      clicks,
      purchases,
      purchaseValue,
      roas,
      cpa: purchases > 0 ? spend / purchases : null,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      thumbstopRate: wavg(thumb, (d) => d.thumbstopRate ?? 0),
      holdRate: wavg(hold, (d) => d.holdRate ?? 0),
      spendLast7,
      roasLast7,
      roasPrior7,
      status,
    });
  }
  ads.sort((a, b) => b.spend - a.spend);

  const judged = ads.filter((a) => a.status !== "testing").length;
  const winners = ads.filter((a) => a.status === "winner" || a.status === "fatiguing").length;

  // launch velocity by ISO week (last 8 weeks)
  const velocityMap = new Map<string, number>();
  for (let i = 7; i >= 0; i--) {
    const wk = new Date(todayMs - i * 7 * 86400000);
    velocityMap.set(weekKey(wk), 0);
  }
  for (const a of ads) {
    const k = weekKey(new Date(a.launchedAt));
    if (velocityMap.has(k)) velocityMap.set(k, (velocityMap.get(k) ?? 0) + 1);
  }
  const velocity = [...velocityMap].map(([week, launched]) => ({ week, launched }));

  const byField = {} as CreativeSummary["byField"];
  for (const f of fields) {
    const m = new Map<string, { ads: number; spend: number; purchases: number; value: number; winners: number }>();
    for (const a of ads) {
      const v = a.taxonomy[f];
      if (!v) continue;
      const cur = m.get(v) ?? { ads: 0, spend: 0, purchases: 0, value: 0, winners: 0 };
      cur.ads += 1;
      cur.spend += a.spend;
      cur.purchases += a.purchases;
      cur.value += a.purchaseValue;
      if (a.status === "winner" || a.status === "fatiguing") cur.winners += 1;
      m.set(v, cur);
    }
    byField[f] = [...m]
      .map(([value, s]) => ({ value, ads: s.ads, spend: s.spend, purchases: s.purchases, roas: s.spend > 0 ? s.value / s.spend : 0, winners: s.winners }))
      .sort((a, b) => b.spend - a.spend);
  }

  return {
    ads,
    hitRate: judged > 0 ? winners / judged : 0,
    judged,
    winners,
    velocity,
    byField,
    conventionValidPct: ads.length ? ads.filter((a) => a.valid).length / ads.length : 0,
  };
}

function weekKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - day + 1); // Monday
  return x.toISOString().slice(0, 10);
}
