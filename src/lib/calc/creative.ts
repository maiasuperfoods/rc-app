/**
 * Creative performance engine. Same rules as the program's strategist dashboard:
 *   tested      = spent ≥ minSpend in the selected range
 *   winner      = NC ROAS ≥ winRoas (or NC CPA ≤ winCpa when set)
 *   potential   = NC ROAS between potRoas and winRoas
 *   loser       = every other tested ad; untested ads are never losers
 *   hit rate    = winners ÷ tested
 *   Creative Score (0–100) = ½ efficiency + ½ scale
 *     efficiency = NC ROAS ÷ winner line, capped at 1.5
 *     scale      = share of the team's ad spend
 *   confidence  = Low <10 tested · Medium 10–29 · High 30+ (plus a 90% Wilson range on the hit rate)
 *   hook = 3s plays ÷ impressions · hold = thruplays ÷ 3s plays · link CTR = link clicks ÷ impressions
 *   weak spot   = first funnel stage ≥10% below the account average: hook → retention → CTA → post-click
 * Strategist, angle, awareness and type are read from the ad name with the SOP
 *   Angle | Awareness | Name | Type | Product | Strategist
 */
import type { AdDailyInsight, CreativeRules, CreativeTask } from "@/lib/types";

export type TaxonomyField = "angle" | "awareness" | "name" | "type" | "product" | "strategist";
export const TAXONOMY_FIELDS: TaxonomyField[] = ["angle", "awareness", "name", "type", "product", "strategist"];
const ALIASES: Record<string, TaxonomyField> = { stage: "awareness", format: "type", creator: "strategist", hook: "name", avatar: "name", iteration: "name" };
export const DEFAULT_CONVENTION = "[Angle] | [Awareness] | [Name] | [Type] | [Product] | [Strategist]";

export function parseConvention(convention: string): TaxonomyField[] {
  return convention
    .split("|")
    .map((s) => s.replace(/[\[\]]/g, "").trim().toLowerCase())
    .map((s) => (TAXONOMY_FIELDS as string[]).includes(s) ? (s as TaxonomyField) : ALIASES[s])
    .filter((s): s is TaxonomyField => Boolean(s));
}

export type Taxonomy = Partial<Record<TaxonomyField, string>>;

export function parseAdName(name: string, fields: TaxonomyField[]): { taxonomy: Taxonomy; valid: boolean } {
  const parts = name.split("|").map((p) => p.trim());
  const valid = fields.length > 0 && parts.length >= fields.length;
  const taxonomy: Taxonomy = {};
  if (valid) fields.forEach((f, i) => { if (parts[i]) taxonomy[f] = parts[i]; });
  return { taxonomy, valid };
}

export const UNASSIGNED = "__unassigned";

// ---- per-ad aggregation over a date range -----------------------------------

export interface AdRecord {
  adId: string;
  adName: string;
  adSetName: string;
  campaignName: string;
  status: AdDailyInsight["status"];
  format: "Video" | "Static";
  thumbnailUrl: string | null;
  launchedAt: string;
  taxonomy: Taxonomy;
  valid: boolean;
  strategist: string; // code, or UNASSIGNED
  days: AdDailyInsight[];
}

export function groupAds(rows: AdDailyInsight[], fields: TaxonomyField[]): AdRecord[] {
  const by = new Map<string, AdRecord>();
  for (const r of rows) {
    let a = by.get(r.adId);
    if (!a) {
      const { taxonomy, valid } = parseAdName(r.adName, fields);
      const sAdset = !valid ? parseAdName(r.adSetName, fields) : null; // renamed ad → fall back to the ad set name
      const tax = valid ? taxonomy : sAdset?.valid ? sAdset.taxonomy : {};
      a = { adId: r.adId, adName: r.adName, adSetName: r.adSetName, campaignName: r.campaignName, status: r.status, format: r.format, thumbnailUrl: r.thumbnailUrl, launchedAt: r.launchedAt, taxonomy: tax, valid: valid || Boolean(sAdset?.valid), strategist: tax.strategist?.trim() || UNASSIGNED, days: [] };
      by.set(r.adId, a);
    }
    a.days.push(r);
    if (r.date > (a.days[0]?.date ?? "")) a.status = r.status; // latest status wins
  }
  return [...by.values()];
}

export type Stage = "winner" | "potential" | "loser" | "untested";
export type WeakSpot = "hook" | "ret" | "cta" | "post" | "strong";

export interface AdMetrics {
  active: boolean; // had rows in range
  spend: number;
  imp: number;
  clicks: number;
  linkClicks: number;
  meta: number; metaRev: number;
  tw: number; twRev: number;
  nc: number; ncRev: number;
  v3: number; thru: number; vimp: number; // video funnel (impressions on days with video data)
  nv: number; uv: number; nvSpend: number;
  ncRoas: number; twRoas: number; metaRoas: number;
  ncCpa: number | null; twCpa: number | null; metaCpa: number | null;
  ctr: number | null; hook: number | null; hold: number | null;
  nvp: number | null; costNv: number | null;
  judgedCreative: boolean; judgedVideo: boolean;
  stage: Stage;
  diag: WeakSpot | null;
  launchedInRange: boolean;
}

export interface Bench { hook: number | null; hold: number | null; ctr: number | null }

export function aggregate(a: AdRecord, d1: string, d2: string, rules: CreativeRules, bench: Bench | null): AdMetrics {
  const m: AdMetrics = { active: false, spend: 0, imp: 0, clicks: 0, linkClicks: 0, meta: 0, metaRev: 0, tw: 0, twRev: 0, nc: 0, ncRev: 0, v3: 0, thru: 0, vimp: 0, nv: 0, uv: 0, nvSpend: 0, ncRoas: 0, twRoas: 0, metaRoas: 0, ncCpa: null, twCpa: null, metaCpa: null, ctr: null, hook: null, hold: null, nvp: null, costNv: null, judgedCreative: false, judgedVideo: false, stage: "untested", diag: null, launchedInRange: a.launchedAt >= d1 && a.launchedAt <= d2 };
  for (const r of a.days) {
    if (r.date < d1 || r.date > d2) continue;
    m.active = true;
    m.spend += r.spend; m.imp += r.impressions; m.clicks += r.clicks; m.linkClicks += r.linkClicks;
    m.meta += r.metaPurchases; m.metaRev += r.metaRevenue; m.tw += r.twPurchases; m.twRev += r.twRevenue; m.nc += r.ncPurchases; m.ncRev += r.ncRevenue;
    if (r.plays3s != null) { m.v3 += r.plays3s; m.thru += r.thruplays ?? 0; m.vimp += r.impressions; }
    if (r.uniqueVisitors != null) { m.nv += r.newVisitors ?? 0; m.uv += r.uniqueVisitors; m.nvSpend += r.spend; }
  }
  m.ncRoas = m.spend ? m.ncRev / m.spend : 0; m.twRoas = m.spend ? m.twRev / m.spend : 0; m.metaRoas = m.spend ? m.metaRev / m.spend : 0;
  m.ncCpa = m.nc ? m.spend / m.nc : null; m.twCpa = m.tw ? m.spend / m.tw : null; m.metaCpa = m.meta ? m.spend / m.meta : null;
  m.nvp = m.uv ? m.nv / m.uv : null; m.costNv = m.nv ? m.nvSpend / m.nv : null;
  m.judgedCreative = m.imp >= rules.minImp;
  m.judgedVideo = m.judgedCreative && a.format === "Video" && m.v3 > 0;
  m.ctr = m.judgedCreative && m.imp ? m.linkClicks / m.imp : null;
  m.hook = m.judgedVideo ? Math.min(1, m.v3 / m.vimp) : null;
  m.hold = m.judgedVideo ? Math.min(1, m.thru / m.v3) : null;
  m.stage = m.spend < rules.minSpend ? "untested" : m.ncRoas >= rules.winRoas || (rules.winCpa > 0 && m.nc > 0 && m.ncCpa! <= rules.winCpa) ? "winner" : m.ncRoas >= rules.potRoas ? "potential" : "loser";
  m.diag = bench ? diagnose(m, bench) : null;
  return m;
}

const UP = 1.1, DOWN = 0.9;
export function diagnose(m: AdMetrics, b: Bench): WeakSpot | null {
  if (!m.judgedCreative || b.ctr == null) return null;
  const low = (v: number | null, ref: number | null) => v != null && ref != null && v <= ref * DOWN;
  if (m.judgedVideo && low(m.hook, b.hook)) return "hook";
  if (m.judgedVideo && low(m.hold, b.hold)) return "ret";
  if (low(m.ctr, b.ctr)) return "cta";
  if (m.stage === "loser" || m.stage === "potential") return "post";
  if (m.stage === "winner") return "strong";
  return null;
}
export const WEAK_SPOT: Record<WeakSpot, [string, string]> = {
  hook: ["Hook", "Fewer than average stop scrolling — rework the first 3 seconds"],
  ret: ["Retention", "They stop but drop before the end — tighten the body and pacing"],
  cta: ["CTA / offer", "They watch but don't click — sharpen the CTA, offer or reason to click"],
  post: ["Post-click", "Gets the click but doesn't convert — check landing page, offer, audience"],
  strong: ["Strong creative", "Above average at every stage"],
};
export function relTone(v: number | null, b: number | null): "g" | "w" | "r" | "n" {
  if (v == null || b == null || !b) return "n";
  return v >= b * UP ? "g" : v <= b * DOWN ? "r" : "w";
}

/** Pooled averages (Σ numerator ÷ Σ denominator) so big ads weigh more. */
export function pool(ms: AdMetrics[]): Bench & { videos: number; ads: number } {
  const s = { v3: 0, thru: 0, vimp: 0, lc: 0, cimp: 0, videos: 0, ads: 0 };
  for (const m of ms) {
    if (m.judgedVideo) { s.v3 += m.v3; s.thru += m.thru; s.vimp += m.vimp; s.videos++; }
    if (m.judgedCreative) { s.lc += m.linkClicks; s.cimp += m.imp; s.ads++; }
  }
  return { hook: s.vimp ? s.v3 / s.vimp : null, hold: s.v3 ? s.thru / s.v3 : null, ctr: s.cimp ? s.lc / s.cimp : null, videos: s.videos, ads: s.ads };
}

// ---- summaries ---------------------------------------------------------------

export interface Summary {
  n: number; spend: number; ncRev: number; twRev: number; metaRev: number; nc: number; tw: number; meta: number;
  tested: number; winner: number; potential: number; loser: number; untested: number; launched: number;
  ts: number; ws: number; // tested spend, winner spend
  hit: number; sw: number; ncRoas: number; twRoas: number; metaRoas: number; ncCpa: number | null;
}
export function summarize(list: { m: AdMetrics }[]): Summary {
  const s: Summary = { n: list.length, spend: 0, ncRev: 0, twRev: 0, metaRev: 0, nc: 0, tw: 0, meta: 0, tested: 0, winner: 0, potential: 0, loser: 0, untested: 0, launched: 0, ts: 0, ws: 0, hit: 0, sw: 0, ncRoas: 0, twRoas: 0, metaRoas: 0, ncCpa: null };
  for (const { m } of list) {
    s.spend += m.spend; s.ncRev += m.ncRev; s.twRev += m.twRev; s.metaRev += m.metaRev; s.nc += m.nc; s.tw += m.tw; s.meta += m.meta;
    s[m.stage]++;
    if (m.stage !== "untested") { s.tested++; s.ts += m.spend; if (m.stage === "winner") s.ws += m.spend; }
    if (m.launchedInRange) s.launched++;
  }
  s.hit = s.tested ? s.winner / s.tested : 0; s.sw = s.ts ? s.ws / s.ts : 0;
  s.ncRoas = s.spend ? s.ncRev / s.spend : 0; s.twRoas = s.spend ? s.twRev / s.spend : 0; s.metaRoas = s.spend ? s.metaRev / s.spend : 0;
  s.ncCpa = s.nc ? s.spend / s.nc : null;
  return s;
}

export function wilson(w: number, n: number, z = 1.645): [number, number] {
  if (!n) return [0, 1];
  const p = w / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

export interface LeaderRow {
  key: string; name: string; s: Summary; cs: ReturnType<typeof pool>; score: number; q: number; impact: number; lo: number; hi: number;
  conf: ["lo" | "md" | "hi", string]; person: boolean; ranked: boolean; rank?: number;
}
export function leaderboard(items: { ad: AdRecord; m: AdMetrics }[], strategists: Record<string, string>, rules: CreativeRules) {
  const keys = [...new Set(items.map((x) => x.ad.strategist))];
  const people = keys.filter((k) => k !== UNASSIGNED);
  const teamItems = items.filter((x) => x.ad.strategist !== UNASSIGNED);
  const team = summarize(teamItems);
  const rows: LeaderRow[] = keys
    .map((k) => {
      const mine = items.filter((x) => x.ad.strategist === k);
      const s = summarize(mine);
      const q = Math.min(1.5, (s.spend ? s.ncRoas : 0) / rules.winRoas);
      const impact = team.spend ? s.spend / team.spend : 0;
      const score = 0.5 * q + 0.5 * impact;
      const [lo, hi] = wilson(s.winner, s.tested);
      const conf: LeaderRow["conf"] = s.tested >= 30 ? ["hi", "High"] : s.tested >= 10 ? ["md", "Medium"] : ["lo", "Low"];
      const person = people.includes(k);
      return { key: k, name: k === UNASSIGNED ? "Unassigned" : strategists[k] ?? k, s, cs: pool(mine.map((x) => x.m)), score, q, impact, lo, hi, conf, person, ranked: person && s.tested >= rules.minTested };
    })
    .filter((r) => r.s.n > 0);
  const by = (a: LeaderRow, b: LeaderRow) => b.score - a.score || b.s.ws - a.s.ws || b.s.winner - a.s.winner;
  const ranked = rows.filter((r) => r.ranked).sort(by);
  ranked.forEach((r, i) => (r.rank = i + 1));
  const unranked = rows.filter((r) => r.person && !r.ranked).sort((a, b) => b.s.tested - a.s.tested || b.s.winner - a.s.winner || b.s.spend - a.s.spend);
  const other = rows.filter((r) => !r.person);
  const act = rows.filter((r) => r.person && r.s.tested > 0);
  const avg = act.length ? act.reduce((a, r) => a + r.score, 0) / act.length : 0;
  return { ranked, unranked, other, all: rows, avg, team, p0: team.ts ? team.ws / team.ts : 0 };
}

/** Breakdown by one taxonomy field. Only values with at least one tested ad. */
export function breakdown(items: { ad: AdRecord; m: AdMetrics }[], field: TaxonomyField) {
  const g = new Map<string, { ad: AdRecord; m: AdMetrics }[]>();
  let off = 0;
  for (const x of items) {
    const v = x.ad.taxonomy[field]?.trim();
    if (!v) { off++; continue; }
    const arr = g.get(v) ?? [];
    arr.push(x);
    g.set(v, arr);
  }
  const rows = [...g].map(([key, l]) => ({ key, s: summarize(l) })).filter((r) => r.s.tested > 0);
  return { rows, off };
}

/** Day buckets for short ranges, Monday-start weeks otherwise. */
export function buckets(d1: string, d2: string): { d1: string; d2: string; label: string }[] {
  const out: { d1: string; d2: string; label: string }[] = [];
  const s = new Date(d1 + "T00:00:00Z"), e = new Date(d2 + "T00:00:00Z");
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const add = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
  const span = (e.getTime() - s.getTime()) / 86400000 + 1;
  if (span <= 14) { for (let d = s; d <= e; d = add(d, 1)) out.push({ d1: iso(d), d2: iso(d), label: iso(d).slice(5) }); return out; }
  let w = add(s, -((s.getUTCDay() || 7) - 1));
  while (w <= e) {
    const w2 = add(w, 6);
    const a = w < s ? s : w, b = w2 > e ? e : w2;
    out.push({ d1: iso(a), d2: iso(b), label: iso(a).slice(5) });
    w = add(w, 7);
  }
  return out;
}

// ---- Creative Output (ClickUp) ---------------------------------------------

export const PIPELINE: CreativeTask["status"][] = ["ready for edit", "pre-launch review", "revisions", "ready for launch"];

export function outputStats(tasks: CreativeTask[], d1: string, d2: string) {
  const inR = (d: string | null) => Boolean(d && d >= d1 && d <= d2);
  const days = Math.max(1, (new Date(d2).getTime() - new Date(d1).getTime()) / 86400000 + 1);
  const briefs = tasks.filter((t) => inR(t.briefDate));
  const speedT = tasks.filter((t) => t.briefDate && t.readyDate && inR(t.readyDate));
  const speed = speedT.length ? speedT.reduce((a, t) => a + (new Date(t.readyDate!).getTime() - new Date(t.briefDate!).getTime()) / 86400000, 0) / speedT.length : null;
  const cnt = (s: CreativeTask["status"]) => tasks.filter((t) => t.status === s && inR(t.updatedAt.slice(0, 10))).length;
  const published = tasks.filter((t) => t.status === "completee" && inR(t.closedDate)).length;
  const byPerson = (keyOf: (t: CreativeTask) => string[]) => {
    const m = new Map<string, { briefs: number; sp: number[]; rfl: number; pub: number; inEdit: number }>();
    for (const t of tasks) for (const k of keyOf(t)) {
      const b = m.get(k) ?? { briefs: 0, sp: [], rfl: 0, pub: 0, inEdit: 0 };
      if (inR(t.briefDate)) b.briefs++;
      if (t.briefDate && t.readyDate && inR(t.readyDate)) b.sp.push((new Date(t.readyDate).getTime() - new Date(t.briefDate).getTime()) / 86400000);
      if (t.status === "ready for launch" && inR(t.updatedAt.slice(0, 10))) b.rfl++;
      if (t.status === "completee" && inR(t.closedDate)) b.pub++;
      if (["ready for edit", "revisions", "pre-launch review"].includes(t.status) && inR(t.updatedAt.slice(0, 10))) b.inEdit++;
      m.set(k, b);
    }
    return [...m].map(([key, b]) => ({ key, briefs: b.briefs, speed: b.sp.length ? b.sp.reduce((a, x) => a + x, 0) / b.sp.length : null, rfl: b.rfl, pub: b.pub, inEdit: b.inEdit })).sort((a, b) => b.briefs - a.briefs || b.pub - a.pub);
  };
  return { briefs: briefs.length, perWeek: (briefs.length / days) * 7, speed, inEdit: cnt("ready for edit"), pre: cnt("pre-launch review"), rev: cnt("revisions"), rfl: cnt("ready for launch"), published, byStrategist: byPerson((t) => (t.strategist ? [t.strategist] : ["Unassigned"])), byEditor: byPerson((t) => (t.editors.length ? t.editors : ["Unassigned"])) };
}

// ---- compact read for Home / Admin (last 30 days) ------------------------------

export interface CreativeOverview {
  hitRate: number;
  tested: number;
  winners: { adId: string; label: string; ncRoas: number; strategist: string }[];
  launched2w: number;
  spend: number;
  ncRoas: number;
  conventionValidPct: number;
}
export function creativeOverview(rows: AdDailyInsight[], convention: string, strategists: Record<string, string>, rules: CreativeRules, today = new Date()): CreativeOverview {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const d2 = iso(today), d1 = iso(new Date(today.getTime() - 29 * 86400000)), d14 = iso(new Date(today.getTime() - 13 * 86400000));
  const ads = groupAds(rows, parseConvention(convention));
  const items = ads.map((ad) => ({ ad, m: aggregate(ad, d1, d2, rules, null) })).filter((x) => x.m.active);
  const s = summarize(items);
  const winners = items.filter((x) => x.m.stage === "winner").sort((a, b) => b.m.spend - a.m.spend).map((x) => ({ adId: x.ad.adId, label: x.ad.taxonomy.angle ? `${x.ad.taxonomy.angle} · ${x.ad.taxonomy.name ?? ""}` : x.ad.adName, ncRoas: x.m.ncRoas, strategist: strategists[x.ad.strategist] ?? (x.ad.strategist === UNASSIGNED ? "Unassigned" : x.ad.strategist) }));
  return { hitRate: s.hit, tested: s.tested, winners, launched2w: ads.filter((a) => a.launchedAt >= d14).length, spend: s.spend, ncRoas: s.ncRoas, conventionValidPct: ads.length ? ads.filter((a) => a.valid).length / ads.length : 0 };
}
