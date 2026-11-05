"use client";
import { Fragment, useMemo, useState, useTransition, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Card, Pill, fmtMoney, fmtPct, fmtX } from "@/components/ui";
import type { AdDailyInsight, CreativeRules, CreativeTask } from "@/lib/types";
import { saveCreativeRules } from "@/app/actions";
import {
  UNASSIGNED, WEAK_SPOT, aggregate, breakdown, buckets, groupAds, leaderboard, outputStats, parseConvention, pool, relTone, summarize,
  type AdMetrics, type AdRecord, type Bench, type LeaderRow, type Stage, type TaxonomyField, type WeakSpot,
} from "@/lib/calc/creative";

/* ------------------------------------------------------------------------- */
/*  Props and small helpers                                                  */
/* ------------------------------------------------------------------------- */

interface Props {
  brandName: string;
  rows: AdDailyInsight[];
  tasks: CreativeTask[];
  daily: { date: string; revenue: number; adSpend: number; newCustomers: number }[];
  convention: string;
  strategists: Record<string, string>;
  rules: CreativeRules;
  hasPixel: boolean;
  timezone: string;
  canEditRules: boolean;
}

type Item = { ad: AdRecord; m: AdMetrics };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addD = (s: string, n: number) => iso(new Date(new Date(s + "T00:00:00Z").getTime() + n * 86400000));
const fmtM2 = (n: number | null) => (n == null ? "—" : fmtMoney(n, 2));
const fmtN = (n: number) => Math.round(n).toLocaleString();
const fmtS = (s: number) => Math.round(s * 100).toString();
const fmtD = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const STAGE_COLORS = ["#c9a961", "#7fa6d6", "#7fb88a", "#d9a853", "#d66b6b", "#b48ad6", "#6fc3c9", "#e0945f"];

function Delta({ cur, prev, dir = 1 }: { cur: number | null | undefined; prev: number | null | undefined; dir?: 1 | -1 }) {
  if (cur == null || prev == null || !prev) return null;
  const d = (cur - prev) / Math.abs(prev);
  const good = d * dir >= 0;
  if (Math.abs(d) < 0.005) return <span className="text-[11px] text-mute ml-2">·</span>;
  return <span className={`text-[11px] ml-2 ${good ? "text-good" : "text-bad"}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d * 100).toFixed(0)}%</span>;
}

function Kpi({ label, value, desc, delta, tone, hit, meter, onClick, selected }: { label: string; value: ReactNode; desc?: ReactNode; delta?: ReactNode; tone?: "g" | "w" | "r" | "n"; hit?: boolean; meter?: number; onClick?: () => void; selected?: boolean }) {
  const vc = tone === "g" ? "text-good" : tone === "r" ? "text-bad" : tone === "w" ? "text-warn" : "text-ink";
  return (
    <div className={`card p-4 ${hit ? "border-gold bg-gold-dim/40" : ""} ${onClick ? "cursor-pointer hover:border-line-strong" : ""} ${selected ? "border-gold" : ""}`} onClick={onClick}>
      <div className="label flex items-center">{label}{delta}</div>
      <div className={`text-2xl font-medium mt-1 tabular-nums ${vc}`}>{value}</div>
      {desc && <div className="text-xs text-mute mt-1">{desc}</div>}
      {meter != null && <div className="h-1 bg-hover rounded-full mt-2 overflow-hidden"><div className="h-full bg-gold" style={{ width: `${Math.min(100, meter * 100)}%` }} /></div>}
    </div>
  );
}

const StageChip = ({ s }: { s: Stage }) => <Pill tone={s === "winner" ? "good" : s === "potential" ? "warn" : s === "loser" ? "bad" : "mute"}>{s}</Pill>;
const Rate = ({ v, b }: { v: number | null; b: number | null }) => { const t = relTone(v, b); return <span className={`tabular-nums ${t === "g" ? "text-good" : t === "r" ? "text-bad" : t === "w" ? "text-warn" : "text-mute"}`}>{v == null ? "—" : fmtPct(v, 1)}</span>; };
const WkChip = ({ k }: { k: WeakSpot | null }) => (k ? <span title={WEAK_SPOT[k][1]}><Pill tone={k === "hook" ? "bad" : k === "ret" ? "warn" : k === "cta" ? "info" : k === "post" ? "mute" : "good"}>{WEAK_SPOT[k][0]}</Pill></span> : <span className="text-mute">—</span>);
const RoasCell = ({ v, rules }: { v: number; rules: CreativeRules }) => <span className={`tabular-nums font-medium ${v >= rules.winRoas ? "text-good" : v >= rules.potRoas ? "text-warn" : "text-bad"}`}>{fmtX(v)}</span>;

/* ------------------------------------------------------------------------- */
/*  Dashboard                                                                */
/* ------------------------------------------------------------------------- */

export function CreativeDashboard(p: Props) {
  const dataEnd = useMemo(() => p.rows.reduce((a, r) => (r.date > a ? r.date : a), ""), [p.rows]);
  const dataStart = useMemo(() => p.rows.reduce((a, r) => (r.date < a ? r.date : a), "9999"), [p.rows]);
  const [view, setView] = useState<"perf" | "output">("perf");
  const [preset, setPreset] = useState("30");
  const [range, setRange] = useState<[string, string]>([addD(dataEnd, -29), dataEnd]);
  const [compare, setCompare] = useState(true);
  const [f, setF] = useState({ product: "", type: "", angle: "", aware: "", stage: "" as Stage | "", q: "" });
  const [minSpend, setMinSpend] = useState(p.rules.minSpend);
  const [tab, setTab] = useState<string>("OVERVIEW");
  const [rules, setRules] = useState(p.rules);
  const [drawer, setDrawer] = useState<"none" | "settings" | "defs">("none");
  const [lbOpen, setLbOpen] = useState(false);
  const [kpiMetric, setKpiMetric] = useState<"spend" | "ncRoas" | "hit" | "nc">("ncRoas");
  const [pending, start] = useTransition();
  const fields = useMemo(() => parseConvention(p.convention), [p.convention]);
  const ads = useMemo(() => groupAds(p.rows, fields), [p.rows, fields]);
  const R = { ...rules, minSpend };

  const applyPreset = (k: string) => {
    setPreset(k);
    if (k === "all") setRange([dataStart, dataEnd]);
    else if (k === "thismonth") setRange([dataEnd.slice(0, 8) + "01", dataEnd]);
    else if (k === "lastmonth") { const d = new Date(dataEnd.slice(0, 7) + "-01T00:00:00Z"); const end = addD(iso(d), -1); setRange([end.slice(0, 8) + "01", end]); }
    else setRange([addD(dataEnd, -(Number(k) - 1)), dataEnd]);
  };
  const [d1, d2] = range;
  const span = Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000) + 1;
  const prevRange: [string, string] = [addD(d1, -span), addD(d1, -1)];

  const passesFilters = (ad: AdRecord) => {
    if (f.product && ad.taxonomy.product !== f.product) return false;
    if (f.type && ad.taxonomy.type !== f.type) return false;
    if (f.angle && ad.taxonomy.angle !== f.angle) return false;
    if (f.aware && ad.taxonomy.awareness !== f.aware) return false;
    const q = f.q.trim().toLowerCase();
    if (q && !`${ad.adName} ${ad.adSetName} ${ad.campaignName}`.toLowerCase().includes(q)) return false;
    return true;
  };
  const build = (rg: [string, string]) => {
    const base = ads.map((ad) => ({ ad, m: aggregate(ad, rg[0], rg[1], R, null) })).filter((x) => x.m.active);
    const bench: Bench = pool(base.map((x) => x.m));
    const items: Item[] = base.map(({ ad }) => ({ ad, m: aggregate(ad, rg[0], rg[1], R, bench) }));
    return { items, bench };
  };
  const cur = useMemo(() => build(range), [ads, d1, d2, R.minSpend, R.winRoas, R.winCpa, R.potRoas, R.minImp]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => (compare ? build(prevRange) : null), [ads, compare, prevRange[0], prevRange[1], R.minSpend, R.winRoas, R.winCpa, R.potRoas, R.minImp]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = (items: Item[], strat: string | null) => items.filter((x) => passesFilters(x.ad) && (!strat || x.ad.strategist === strat) && (!f.stage || x.m.stage === f.stage));
  const all = visible(cur.items, tab === "OVERVIEW" ? null : tab);
  const allPrev = prev ? visible(prev.items, tab === "OVERVIEW" ? null : tab) : null;
  const S = summarize(all);
  const PS = allPrev ? summarize(allPrev) : null;
  const L = leaderboard(visible(cur.items, null), p.strategists, R);
  const PL = prev ? leaderboard(visible(prev.items, null), p.strategists, R) : null;
  const me = tab === "OVERVIEW" ? null : L.all.find((r) => r.key === tab) ?? null;
  const pme = PL && tab !== "OVERVIEW" ? PL.all.find((r) => r.key === tab) ?? null : null;

  const blended = (rg: [string, string]) => { const d = p.daily.filter((x) => x.date >= rg[0] && x.date <= rg[1]); const sp = d.reduce((a, x) => a + x.adSpend, 0), rv = d.reduce((a, x) => a + x.revenue, 0), no = d.reduce((a, x) => a + x.newCustomers, 0); return sp ? { sp, rv, no } : null; };
  const B = blended(range), PB = prev ? blended(prevRange) : null;

  const options = (field: TaxonomyField) => [...new Set(ads.map((a) => a.taxonomy[field]).filter(Boolean) as string[])].sort();
  const stratKeys = [...new Set(ads.map((a) => a.strategist))].filter((k) => k !== UNASSIGNED).sort((a, b) => (p.strategists[a] ?? a).localeCompare(p.strategists[b] ?? b));
  const hasUnassigned = ads.some((a) => a.strategist === UNASSIGNED);
  const colorOf = (k: string) => STAGE_COLORS[Math.max(0, [...stratKeys, UNASSIGNED].indexOf(k)) % STAGE_COLORS.length];
  const nameOf = (k: string) => (k === UNASSIGNED ? "Unassigned" : p.strategists[k] ?? k);

  const saveRules = () => start(async () => { await saveCreativeRules({ ...rules, minSpend }); });

  const chips: [string, () => void][] = [];
  if (f.product) chips.push([`product: ${f.product}`, () => setF({ ...f, product: "" })]);
  if (f.type) chips.push([`type: ${f.type}`, () => setF({ ...f, type: "" })]);
  if (f.angle) chips.push([`angle: ${f.angle}`, () => setF({ ...f, angle: "" })]);
  if (f.aware) chips.push([`awareness: ${f.aware}`, () => setF({ ...f, aware: "" })]);
  if (f.stage) chips.push([`stage: ${f.stage}`, () => setF({ ...f, stage: "" })]);
  if (f.q) chips.push([`"${f.q}"`, () => setF({ ...f, q: "" })]);

  return (
    <div className="space-y-4">
      {/* ---- top bar ---- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-3xl leading-tight">Creative Strategy</h1>
          <p className="text-dim text-xs mt-1">{p.brandName} · data through {fmtD(dataEnd)} · showing <b className="text-ink">{fmtD(d1)} → {fmtD(d2)}</b>{compare ? <> · compared with {fmtD(prevRange[0])} → {fmtD(prevRange[1])}</> : null} · {p.timezone}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-line bg-elev p-0.5">
            <button className={`px-3 py-1.5 rounded-md text-sm ${view === "perf" ? "bg-panel text-ink" : "text-dim"}`} onClick={() => setView("perf")}>Performance <span className="text-mute text-xs">Triple Whale</span></button>
            <button className={`px-3 py-1.5 rounded-md text-sm ${view === "output" ? "bg-panel text-ink" : "text-dim"}`} onClick={() => setView("output")}>Creative Output <span className="text-mute text-xs">ClickUp</span></button>
          </div>
          <button className="btn btn-ghost" onClick={() => setDrawer("settings")}>⚙ Settings</button>
          <button className="btn btn-ghost" onClick={() => setDrawer("defs")}>ⓘ Definitions</button>
        </div>
      </div>

      {!p.hasPixel && <div className="rounded-md bg-warn-dim text-warn text-sm px-3 py-2">Triple Whale isn&apos;t connected, so new-customer (NC) numbers are empty and every tested ad reads as a loser. Connect it on the Connections page; Meta&apos;s own purchases are still shown.</div>}

      {/* ---- filters ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line-strong overflow-hidden">
          {[["7", "7d"], ["14", "14d"], ["30", "30d"], ["90", "90d"], ["thismonth", "This month"], ["lastmonth", "Last month"], ["all", "All data"]].map(([k, l]) => (
            <button key={k} className={`px-2.5 py-1.5 text-xs border-r border-line last:border-r-0 ${preset === k ? "bg-ink text-bg" : "text-dim hover:text-ink"}`} style={preset === k ? { background: "var(--text)", color: "var(--bg)" } : undefined} onClick={() => applyPreset(k)}>{l}</button>
          ))}
        </div>
        <input className="input w-36 py-1.5 text-xs" type="date" value={d1} max={d2} onChange={(e) => { setPreset("custom"); setRange([e.target.value, d2]); }} />
        <span className="text-mute text-xs">→</span>
        <input className="input w-36 py-1.5 text-xs" type="date" value={d2} min={d1} max={dataEnd} onChange={(e) => { setPreset("custom"); setRange([d1, e.target.value]); }} />
        <label className="flex items-center gap-1.5 text-xs text-dim ml-1"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare previous period</label>
        <div className="flex-1" />
        {(["product", "type", "angle", "awareness"] as TaxonomyField[]).map((fl) => {
          const key = fl === "awareness" ? "aware" : (fl as "product" | "type" | "angle");
          return <select key={fl} className="input w-auto py-1.5 text-xs" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}><option value="">{fl === "awareness" ? "All awareness" : `All ${fl}s`}</option>{options(fl).map((o) => <option key={o} value={o}>{o}</option>)}</select>;
        })}
        <select className="input w-auto py-1.5 text-xs" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as Stage | "" })}><option value="">All stages</option>{(["winner", "potential", "loser", "untested"] as Stage[]).map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <input className="input w-44 py-1.5 text-xs" type="search" placeholder="Search ads…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <label className="text-xs text-dim flex items-center gap-1">Tested ≥ $<input className="input w-16 py-1 text-xs text-right" type="number" value={minSpend} onChange={(e) => setMinSpend(Number(e.target.value) || 0)} /></label>
      </div>
      {chips.length > 0 && <div className="flex gap-1.5 flex-wrap">{chips.map(([l, clear]) => <button key={l} className="pill pill-info" onClick={clear}>{l} ✕</button>)}</div>}

      {view === "perf" ? (
        <>
          {/* ---- strategist tabs ---- */}
          <div className="flex gap-1 border-b border-line overflow-x-auto">
            {(["OVERVIEW", ...stratKeys, ...(hasUnassigned ? [UNASSIGNED] : [])] as string[]).map((k) => {
              const n = k === "OVERVIEW" ? cur.items.filter((x) => passesFilters(x.ad)).length : cur.items.filter((x) => x.ad.strategist === k && passesFilters(x.ad)).length;
              return (
                <button key={k} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px flex items-center gap-2 ${tab === k ? "border-gold text-ink" : "border-transparent text-dim hover:text-ink"}`} onClick={() => setTab(k)}>
                  {k !== "OVERVIEW" && <span className="h-2 w-2 rounded-sm" style={{ background: colorOf(k) }} />}
                  {k === "OVERVIEW" ? "Overview" : nameOf(k)}
                  <span className="text-[10px] text-mute bg-hover rounded-full px-1.5">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 text-xs flex-wrap">
            <span className="label self-center mr-1">Jump to</span>
            {[["sum", "Summary"], ["cr", "Creative"], ["bd", "Breakdown"], ["ads", "Ads"], ["tr", "Trend"]].map(([id, l]) => <a key={id} href={`#s-${id}`} className="pill pill-mute hover:text-ink">{l}</a>)}
          </div>

          {/* ---- Summary ---- */}
          <section id="s-sum" className="space-y-3 scroll-mt-4">
            {me && (
              <div className="card p-4 flex flex-wrap items-center gap-5">
                <button className="btn btn-ghost" onClick={() => setTab("OVERVIEW")}>←</button>
                <span className="h-3 w-3 rounded-sm" style={{ background: colorOf(me.key) }} />
                <div className="mr-auto"><div className="label">{me.person ? "Strategist" : "Bucket"}</div><div className="display text-xl">{me.name}</div></div>
                <div className="border-l border-line pl-5"><div className="label">Rank</div><div className="text-xl font-medium">{me.ranked ? <>#{me.rank} <span className="text-dim text-sm">of {L.ranked.length}</span></> : "—"}</div><div className="text-xs text-mute">{me.ranked ? `Creative Score ${fmtS(me.score)} · team avg ${fmtS(L.avg)}` : !me.person ? "not ranked (no strategist code)" : `needs ${Math.max(0, R.minTested - me.s.tested)} more tested ads to rank`}</div></div>
                {me.s.tested > 0 && <div className="border-l border-line pl-5"><div className="label">Confidence</div><div className="text-xl"><Pill tone={me.conf[0] === "hi" ? "good" : me.conf[0] === "md" ? "info" : "mute"}>{me.conf[1]}</Pill></div><div className="text-xs text-mute">{me.s.tested} tested ads in range</div></div>}
              </div>
            )}
            <SectionH title="Summary" sub={me ? `How ${me.name}'s ads are doing for the selected dates and filters` : "How the account is doing for the selected dates and filters"} />
            {(() => {
              const hero = [
                <Kpi key="sp" label="Spend" value={fmtMoney(S.spend)} desc={`${S.n} ads${me ? ` · ${me.name}` : ""}`} delta={<Delta cur={S.spend} prev={PS?.spend} />} />,
                <Kpi key="nr" label="Meta TW NC ROAS" value={fmtX(S.ncRoas)} desc="Meta ads · Triple Attribution · new-customer revenue ÷ Meta spend" tone={S.ncRoas >= R.winRoas ? "g" : S.ncRoas >= R.potRoas ? "w" : "r"} delta={<Delta cur={S.ncRoas} prev={PS?.ncRoas} />} />,
                <Kpi key="cpa" label="NC CPA" value={fmtM2(S.ncCpa)} desc={`${fmtN(S.nc)} NC purchases`} delta={<Delta cur={S.ncCpa} prev={PS?.ncCpa} dir={-1} />} />,
                <Kpi key="hit" label="Hit rate" value={fmtPct(S.hit)} desc={S.tested ? `winners ÷ tested${me ? ` · 90% range ${Math.round(me.lo * 100)}–${Math.round(me.hi * 100)}%` : ""}` : "winners ÷ tested"} hit meter={S.hit} delta={PS?.tested ? <Delta cur={S.hit} prev={PS.hit} /> : null} />,
              ];
              if (me) hero.push(<Kpi key="cs" label="Creative Score" value={me.s.tested ? fmtS(me.score) : "—"} desc={me.s.tested ? `NC ROAS ${fmtX(me.s.ncRoas)} → efficiency ${fmtS(me.q)} · ${fmtPct(me.impact)} of team spend` : "no tested ads yet"} meter={me.score} delta={pme?.s.tested ? <Delta cur={me.score} prev={pme.score} /> : null} />);
              return me ? (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{hero}</div>
              ) : (
                <div className="grid lg:grid-cols-[1.2fr_1fr] gap-3">
                  <div className="grid grid-cols-2 gap-3">{hero}</div>
                  <LeaderCompact L={L} colorOf={colorOf} onPick={setTab} onMore={() => setLbOpen(!lbOpen)} open={lbOpen} rules={R} />
                </div>
              );
            })()}
            {!me && lbOpen && <LeaderTable L={L} PL={PL} colorOf={colorOf} rules={R} onPick={setTab} />}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
              {!me && <Kpi label="Creative Score" value={L.all.filter((r) => r.person && r.s.tested > 0).length ? fmtS(L.avg) : "—"} desc={`team average · ${L.ranked.length} ranked`} meter={L.avg} delta={PL ? <Delta cur={L.avg} prev={PL.avg} /> : null} />}
              <Kpi label="Ads launched" value={fmtN(S.launched)} desc="first spend in range" delta={<Delta cur={S.launched} prev={PS?.launched} />} />
              <Kpi label="Ads tested" value={fmtN(S.tested)} desc={`spent $${minSpend}+ in range`} delta={<Delta cur={S.tested} prev={PS?.tested} />} />
              <Kpi label="Winners" value={<>{S.winner} <span className="text-dim text-sm">· {S.potential} potential</span></>} desc={`${S.loser} losers · ${S.untested} untested`} delta={<Delta cur={S.winner} prev={PS?.winner} />} />
              {me && <Kpi label="Spend on winners" value={S.ts ? fmtPct(S.sw) : "—"} desc="share of tested spend" />}
              <Kpi label="TW Blended NC ROAS" value={B ? fmtX(B.rv / B.sp) : "—"} desc={B ? `whole store · all channels` : "no store data"} delta={B && PB ? <Delta cur={B.rv / B.sp} prev={PB.rv / PB.sp} /> : null} />
              <Kpi label="TW Blended NC CPA" value={B && B.no ? fmtM2(B.sp / B.no) : "—"} desc={B ? `${fmtMoney(B.sp)} ÷ ${fmtN(B.no)} new customers` : "no store data"} delta={B && PB && B.no && PB.no ? <Delta cur={B.sp / B.no} prev={PB.sp / PB.no} dir={-1} /> : null} />
              <Kpi label="TW ROAS" value={fmtX(S.twRoas)} desc="all customers · Triple Attribution" delta={<Delta cur={S.twRoas} prev={PS?.twRoas} />} />
              <Kpi label="Meta ROAS" value={fmtX(S.metaRoas)} desc={`${fmtN(S.meta)} Meta purchases`} delta={<Delta cur={S.metaRoas} prev={PS?.metaRoas} />} />
            </div>
            <KpiChart items={all} range={range} rules={R} metric={kpiMetric} setMetric={setKpiMetric} ads={ads} strat={tab === "OVERVIEW" ? null : tab} filterOk={passesFilters} />
          </section>

          {/* ---- Creative engagement ---- */}
          <section id="s-cr" className="space-y-3 scroll-mt-4">
            <SectionH title="Creative engagement" sub={me ? "Their hook, hold and click-through vs the account average" : "Hook, hold and click-through vs the account average"} />
            <CreativeSection items={all} bench={cur.bench} isAcct={!me} rules={R} />
          </section>

          {/* ---- Breakdown ---- */}
          <section id="s-bd" className="space-y-3 scroll-mt-4">
            <SectionH title="Breakdown" sub="Which angles, awareness levels and ad types earn their spend · codes from the naming SOP · click a column to sort" />
            <div className="grid md:grid-cols-3 gap-3">
              {(["angle", "awareness", "type"] as TaxonomyField[]).map((fl) => <BreakdownPanel key={fl} items={all} field={fl} rules={R} />)}
            </div>
          </section>

          {/* ---- Ads ---- */}
          <section id="s-ads" className="space-y-3 scroll-mt-4">
            <AdTable items={all} bench={cur.bench} rules={R} nameOf={nameOf} maxSpend={Math.max(1, ...all.map((x) => x.m.spend))} />
          </section>

          {/* ---- Trend ---- */}
          <section id="s-tr" className="space-y-3 scroll-mt-4">
            <SectionH title="Trend" sub={me ? "Hit rate over time, and every tested ad by NC ROAS vs spend" : "Hit rate over time by strategist · winners ÷ tested, per day or week"} />
            <div className={`grid gap-3 ${me ? "lg:grid-cols-2" : ""}`}>
              <Card title="Hit rate over time" hint="winners ÷ tested, per day or week">
                <TrendChart ads={ads} range={range} rules={R} keys={me ? [me.key] : [...stratKeys]} colorOf={colorOf} nameOf={nameOf} filterOk={passesFilters} />
              </Card>
              {me && (
                <Card title="Winners by NC ROAS vs spend" hint="each dot is a tested ad">
                  <ScatterPanel items={all} rules={R} />
                </Card>
              )}
            </div>
          </section>
        </>
      ) : (
        <OutputView tasks={p.tasks} range={range} prevRange={compare ? prevRange : null} nameOf={nameOf} />
      )}

      {/* ---- drawers ---- */}
      {drawer !== "none" && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawer("none")}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md bg-elev border-l border-line-strong h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="display text-xl">{drawer === "settings" ? "Rules and targets" : "Definitions"}</h3><button className="btn btn-ghost" onClick={() => setDrawer("none")}>Close</button></div>
            {drawer === "settings" ? (
              <div className="space-y-3 text-sm">
                <p className="text-dim text-xs">Used everywhere, including the weekly review. Change with care; it re-classifies every ad.</p>
                {([["minSpend", "Tested = spent at least ($)", 1], ["winRoas", "Winner: NC ROAS at or above (×)", 0.05], ["winCpa", "…or NC CPA at or below ($, 0 = off)", 1], ["potRoas", "Potential: NC ROAS at or above (×)", 0.05], ["minTested", "Tested ads needed to rank a strategist", 1], ["minImp", "Impressions before creative metrics are judged", 100], ["tgtHit", "Weekly target hit rate (0–1)", 0.01], ["tgtTested", "Weekly target tested ads", 1]] as [keyof CreativeRules, string, number][]).map(([k, l, step]) => (
                  <label key={k} className="block"><span className="label block mb-1">{l}</span><input className="input" type="number" step={step} value={k === "minSpend" ? minSpend : rules[k]} onChange={(e) => (k === "minSpend" ? setMinSpend(Number(e.target.value)) : setRules({ ...rules, [k]: Number(e.target.value) }))} /></label>
                ))}
                {p.canEditRules && <button className="btn btn-primary w-full justify-center" onClick={saveRules} disabled={pending}>{pending ? "Saving…" : "Save as this brand's rules"}</button>}
              </div>
            ) : (
              <Definitions rules={R} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionH({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return <div className="flex items-end justify-between gap-3 flex-wrap"><div><h2 className="text-base font-medium text-ink">{title}</h2>{sub && <p className="text-xs text-mute mt-0.5 max-w-3xl">{sub}</p>}</div>{right}</div>;
}

/* ------------------------------------------------------------------------- */
/*  Leaderboard                                                              */
/* ------------------------------------------------------------------------- */

function LeaderCompact({ L, colorOf, onPick, onMore, open, rules }: { L: ReturnType<typeof leaderboard>; colorOf: (k: string) => string; onPick: (k: string) => void; onMore: () => void; open: boolean; rules: CreativeRules }) {
  const top = L.ranked.slice(0, 5);
  return (
    <div className="card flex flex-col">
      <div className="p-4 pb-2"><h3 className="text-sm font-medium">Strategist leaderboard</h3><p className="text-xs text-mute">By Creative Score · needs {rules.minTested} tested ads to rank</p></div>
      {top.length === 0 ? <p className="text-xs text-mute px-4 pb-3">Nobody has {rules.minTested} tested ads in this range yet.</p> : (
        <ul className="px-2">
          {top.map((r) => (
            <li key={r.key} className="grid grid-cols-[32px_1fr_120px_56px] items-center gap-3 px-2 py-2 rounded-md hover:bg-hover cursor-pointer" onClick={() => onPick(r.key)}>
              <span className={`font-medium tabular-nums ${r.rank === 1 ? "text-gold-soft" : "text-dim"}`}>#{r.rank}</span>
              <span className="truncate text-sm"><span className="inline-block h-2 w-2 rounded-sm mr-2" style={{ background: colorOf(r.key) }} />{r.name}<span className="block text-[11px] text-mute">{fmtX(r.s.ncRoas)} NC ROAS · {fmtPct(r.s.hit)} hit · {fmtPct(r.impact)} of spend</span></span>
              <span className="relative h-2 bg-hover rounded-full"><span className="absolute inset-y-0 left-0 bg-gold rounded-full" style={{ width: `${Math.min(100, r.score * 100)}%` }} /><span className="absolute -top-0.5 bottom-[-2px] w-px bg-mute" style={{ left: `${Math.min(100, L.avg * 100)}%` }} /></span>
              <span className="text-right tabular-nums text-sm">{fmtS(r.score)}</span>
            </li>
          ))}
        </ul>
      )}
      {L.unranked.length > 0 && <div className="flex flex-wrap gap-1.5 items-center px-4 py-2 border-t border-dashed border-line mt-auto"><span className="label">Not ranked yet</span>{L.unranked.map((r) => <button key={r.key} className="pill pill-mute" onClick={() => onPick(r.key)}>{r.name} <span className="text-mute">{r.s.tested}/{rules.minTested}</span></button>)}</div>}
      <button className="text-left text-xs text-gold-soft px-4 py-2.5 border-t border-line hover:bg-hover" onClick={onMore}>{open ? "Hide full leaderboard" : "Full leaderboard and how ranking works →"}</button>
    </div>
  );
}

function LeaderTable({ L, PL, colorOf, rules, onPick }: { L: ReturnType<typeof leaderboard>; PL: ReturnType<typeof leaderboard> | null; colorOf: (k: string) => string; rules: CreativeRules; onPick: (k: string) => void }) {
  const row = (r: LeaderRow, kind: "ranked" | "unranked" | "other") => {
    const pts = (r.score - L.p0) * 100;
    const prevR = PL?.all.find((x) => x.key === r.key);
    return (
      <tr key={r.key} className={kind !== "ranked" ? "text-dim" : ""}>
        <td className="tabular-nums w-10">{kind === "ranked" ? `#${r.rank}` : "—"}</td>
        <td><button className="text-ink hover:text-gold-soft font-medium" onClick={() => onPick(r.key)}><span className="inline-block h-2 w-2 rounded-sm mr-2" style={{ background: colorOf(r.key) }} />{r.name}</button>{kind === "unranked" && <span className="text-xs text-mute ml-2">needs {rules.minTested - r.s.tested} more tested</span>}</td>
        <td className="num">{r.s.tested ? <><span className="inline-block h-2 bg-gold rounded-sm align-middle mr-2" style={{ width: Math.min(70, r.score * 70) }} />{fmtS(r.score)}</> : "—"}</td>
        <td className="num"><span className={`text-xs ${Math.abs(pts) < 0.5 ? "text-mute" : pts > 0 ? "text-good" : "text-bad"}`}>{r.s.tested ? `${pts > 0 ? "+" : ""}${pts.toFixed(1)} pts` : "—"}</span></td>
        <td className="num"><RoasCell v={r.s.ncRoas} rules={rules} /></td>
        <td className="num">{fmtPct(r.s.hit)}<span className="block text-[10px] text-mute">{Math.round(r.lo * 100)}–{Math.round(r.hi * 100)}%</span></td>
        <td className="num">{r.s.winner}/{r.s.tested}</td>
        <td className="num">{fmtMoney(r.s.spend)}<span className="block text-[10px] text-mute">{fmtPct(r.impact)} of team</span></td>
        <td className="num">{r.s.ts ? fmtPct(r.s.sw) : "—"}</td>
        <td className="num">{r.s.launched}</td>
        <td><Pill tone={r.conf[0] === "hi" ? "good" : r.conf[0] === "md" ? "info" : "mute"}>{r.conf[1]}</Pill></td>
        <td className="num text-xs">{prevR?.s.tested ? <Delta cur={r.score} prev={prevR.score} /> : "—"}</td>
      </tr>
    );
  };
  return (
    <Card title="Full leaderboard" hint="Creative Score = ½ efficiency (NC ROAS ÷ winner line, capped 1.5) + ½ scale (share of team spend). Ties: more winner spend, then more winners.">
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Rank</th><th>Strategist</th><th className="num">Creative Score</th><th className="num">vs team</th><th className="num">NC ROAS</th><th className="num">Hit rate · 90% range</th><th className="num">Winners / tested</th><th className="num">Spend</th><th className="num">Spend on winners</th><th className="num">Launched</th><th>Confidence</th><th className="num">vs prev</th></tr></thead>
          <tbody>
            {L.ranked.map((r) => row(r, "ranked"))}
            {L.unranked.length > 0 && <tr><td colSpan={12} className="label bg-elev">Not ranked yet</td></tr>}
            {L.unranked.map((r) => row(r, "unranked"))}
            {L.other.length > 0 && <tr><td colSpan={12} className="label bg-elev">Not a strategist</td></tr>}
            {L.other.map((r) => row(r, "other"))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------- */
/*  Creative engagement + diagnostics                                        */
/* ------------------------------------------------------------------------- */

function CreativeSection({ items, bench, isAcct, rules }: { items: Item[]; bench: Bench; isAcct: boolean; rules: CreativeRules }) {
  const P = pool(items.map((x) => x.m));
  const vs = (v: number | null, b: number | null) => (v == null || b == null || !b ? null : `${v >= b ? "+" : ""}${Math.round(((v - b) / b) * 100)}% vs account`);
  const counts: Record<WeakSpot, number> = { hook: 0, ret: 0, cta: 0, post: 0, strong: 0 };
  for (const x of items) if (x.m.diag) counts[x.m.diag]++;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Avg hook rate" value={P.hook == null ? "—" : fmtPct(P.hook, 1)} desc={isAcct ? "3-sec views ÷ impressions (thumb-stop)" : vs(P.hook, bench.hook) ?? "3-sec views ÷ impressions"} tone={isAcct ? "n" : relTone(P.hook, bench.hook)} />
        <Kpi label="Avg hold rate" value={P.hold == null ? "—" : fmtPct(P.hold, 1)} desc={isAcct ? "ThruPlays ÷ 3-sec views" : vs(P.hold, bench.hold) ?? "ThruPlays ÷ 3-sec views"} tone={isAcct ? "n" : relTone(P.hold, bench.hold)} />
        <Kpi label="Avg link CTR" value={P.ctr == null ? "—" : fmtPct(P.ctr, 2)} desc={isAcct ? "link clicks ÷ impressions" : vs(P.ctr, bench.ctr) ?? "link clicks ÷ impressions"} tone={isAcct ? "n" : relTone(P.ctr, bench.ctr)} />
      </div>
      <p className="text-xs text-mute">{P.videos} videos and {P.ads} ads with {rules.minImp.toLocaleString()}+ impressions · colours vs account average for these dates</p>
      <Card title="Where tested ads fall down" hint="First funnel stage where the ad is 10%+ below the account average: hook → retention → CTA → post-click">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(Object.keys(WEAK_SPOT) as WeakSpot[]).map((k) => (
            <div key={k} className="card-elev p-3"><div className="text-xl font-medium tabular-nums">{counts[k]}</div><WkChip k={k} /><div className="text-[11px] text-mute mt-1.5 leading-snug">{WEAK_SPOT[k][1]}</div></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Breakdown                                                                */
/* ------------------------------------------------------------------------- */

function BreakdownPanel({ items, field, rules }: { items: Item[]; field: TaxonomyField; rules: CreativeRules }) {
  const [sort, setSort] = useState<"spend" | "ncRoas" | "hit" | "tested" | "winner">("spend");
  const [all, setAll] = useState(false);
  const { rows, off } = breakdown(items, field);
  const sorted = [...rows].sort((a, b) => (b.s[sort] as number) - (a.s[sort] as number));
  const shown = all ? sorted : sorted.slice(0, 8);
  const th = (k: typeof sort, l: string) => <th className={`num cursor-pointer ${sort === k ? "text-ink" : ""}`} onClick={() => setSort(k)}>{l}{sort === k ? " ▾" : ""}</th>;
  const title = { angle: "By angle", awareness: "By awareness", type: "By ad type" }[field as "angle" | "awareness" | "type"] ?? field;
  return (
    <Card title={title} hint={`${sorted.length > 8 && !all ? "top 8 · " : ""}sorted by ${sort}`}>
      <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>{field}</th>{th("tested", "Tested")}{th("winner", "Winners")}{th("hit", "Hit rate")}{th("spend", "Spend")}{th("ncRoas", "NC ROAS")}</tr></thead>
        <tbody>
          {shown.map((r) => <tr key={r.key}><td className="text-ink">{r.key}</td><td className="num">{r.s.tested}</td><td className="num">{r.s.winner}</td><td className="num">{fmtPct(r.s.hit)}</td><td className="num">{fmtMoney(r.s.spend)}</td><td className="num"><RoasCell v={r.s.ncRoas} rules={rules} /></td></tr>)}
          {shown.length === 0 && <tr><td colSpan={6} className="text-mute text-center py-4">No tested ads with a {field} code.</td></tr>}
        </tbody>
      </table></div>
      <div className="flex justify-between items-center mt-2 text-xs text-mute">
        <span>{off ? `${off} ads without a ${field} code left out` : ""}</span>
        {sorted.length > 8 && <button className="text-gold-soft hover:underline" onClick={() => setAll(!all)}>{all ? "Top 8" : `All ${sorted.length}`}</button>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------- */
/*  Ads table                                                                */
/* ------------------------------------------------------------------------- */

type ColKey = "nc" | "tw" | "meta" | "ncCpa" | "twCpa" | "metaCpa" | "ncRoas" | "twRoas" | "metaRoas" | "hook" | "hold" | "ctr" | "diag" | "nvp" | "costNv";
const ACOLS: [ColKey, string, string, boolean][] = [
  ["nc", "NC TW", "Purchases", true], ["tw", "TW", "Purchases", false], ["meta", "Meta", "Purchases", false],
  ["ncCpa", "NC TW", "CPA", true], ["twCpa", "TW", "CPA", false], ["metaCpa", "Meta", "CPA", false],
  ["ncRoas", "NC TW", "ROAS", true], ["twRoas", "TW", "ROAS", true], ["metaRoas", "Meta", "ROAS", true],
  ["hook", "Hook", "Creative", true], ["hold", "Hold", "Creative", true], ["ctr", "Link CTR", "Creative", true], ["diag", "Weak spot", "Creative", true],
  ["nvp", "NV%", "Traffic", false], ["costNv", "Cost/NV", "Traffic", false],
];
type SortKey = ColKey | "spend" | "stage" | "first" | "strat" | "ad";

function AdTable({ items, bench, rules, nameOf, maxSpend }: { items: Item[]; bench: Bench; rules: CreativeRules; nameOf: (k: string) => string; maxSpend: number }) {
  const [sort, setSort] = useState<SortKey>("spend");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [cols, setCols] = useState<"key" | "all">("key");
  const [q, setQ] = useState("");
  const [minSp, setMinSp] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(40);
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = items.filter((x) => (!terms.length || terms.every((t) => `${x.ad.adName} ${x.ad.adSetName}`.toLowerCase().includes(t))) && x.m.spend >= minSp);
  const stageOrder: Record<Stage, number> = { winner: 0, potential: 1, loser: 2, untested: 3 };
  const wkOrder: Record<WeakSpot, number> = { strong: 0, post: 1, cta: 2, ret: 3, hook: 4 };
  list = [...list].sort((a, b) => {
    if (sort === "first") return a.ad.launchedAt < b.ad.launchedAt ? -dir : a.ad.launchedAt > b.ad.launchedAt ? dir : 0;
    if (sort === "strat") return nameOf(a.ad.strategist).localeCompare(nameOf(b.ad.strategist)) * dir;
    if (sort === "ad") return a.ad.adName.localeCompare(b.ad.adName) * dir;
    if (sort === "stage") return (stageOrder[a.m.stage] - stageOrder[b.m.stage]) * -dir;
    if (sort === "diag") { const ox = a.m.diag ? wkOrder[a.m.diag] : 9, oy = b.m.diag ? wkOrder[b.m.diag] : 9; return (ox - oy) * -dir; }
    const x = (a.m[sort] as number | null) ?? (dir < 0 ? -Infinity : Infinity), y = (b.m[sort] as number | null) ?? (dir < 0 ? -Infinity : Infinity);
    return (y - x) * -dir;
  });
  const vis = ACOLS.filter((c) => cols === "all" || c[3]);
  const groups: { n: string; c: number }[] = [];
  for (const c of vis) { if (groups[groups.length - 1]?.n === c[2]) groups[groups.length - 1].c++; else groups.push({ n: c[2], c: 1 }); }
  const th = (k: SortKey, l: string, cls = "num") => <th rowSpan={2} className={`${cls} cursor-pointer select-none ${sort === k ? "text-ink" : ""}`} onClick={() => { if (sort === k) setDir(dir === 1 ? -1 : 1); else { setSort(k); setDir(-1); } }}>{l}{sort === k ? (dir < 0 ? " ▾" : " ▴") : ""}</th>;
  const cellBody = (k: ColKey, m: AdMetrics): [string, ReactNode] => {
    switch (k) {
      case "nc": return ["num text-info", fmtN(m.nc)];
      case "tw": return ["num text-info", fmtN(m.tw)];
      case "meta": return ["num", fmtN(m.meta)];
      case "ncCpa": return ["num text-info", fmtM2(m.ncCpa)];
      case "twCpa": return ["num text-info", fmtM2(m.twCpa)];
      case "metaCpa": return ["num", fmtM2(m.metaCpa)];
      case "ncRoas": return ["num", <RoasCell key="r" v={m.ncRoas} rules={rules} />];
      case "twRoas": return ["num", fmtX(m.twRoas)];
      case "metaRoas": return ["num", fmtX(m.metaRoas)];
      case "hook": return ["num", <Rate key="r" v={m.hook} b={bench.hook} />];
      case "hold": return ["num", <Rate key="r" v={m.hold} b={bench.hold} />];
      case "ctr": return ["num", <Rate key="r" v={m.ctr} b={bench.ctr} />];
      case "diag": return ["", <WkChip key="r" k={m.diag} />];
      case "nvp": return ["num", m.nvp == null ? "—" : fmtPct(m.nvp)];
      case "costNv": return ["num", fmtM2(m.costNv)];
    }
  };
  return (
    <Card
      title="All ads"
      hint={`${list.length} of ${items.length} ads${minSp ? ` · spend ≥ ${fmtMoney(minSp)}` : ""} · NC TW colour: ≥${rules.winRoas.toFixed(2)} green · ${rules.potRoas.toFixed(2)}–${(rules.winRoas - 0.01).toFixed(2)} amber · below red`}
      actions={<div className="flex gap-2 items-center"><label className="text-xs text-dim">Min spend $<input className="input w-20 py-1 text-xs" type="number" step="100" value={minSp || ""} onChange={(e) => setMinSp(Number(e.target.value) || 0)} /></label><input className="input w-48 py-1 text-xs" type="search" placeholder="Search ad name…" value={q} onChange={(e) => setQ(e.target.value)} /><div className="inline-flex rounded-md border border-line-strong overflow-hidden text-xs"><button className={`px-2 py-1 ${cols === "key" ? "bg-hover text-ink" : "text-dim"}`} onClick={() => setCols("key")}>Key columns</button><button className={`px-2 py-1 ${cols === "all" ? "bg-hover text-ink" : "text-dim"}`} onClick={() => setCols("all")}>All</button></div></div>}
    >
      <div className="overflow-auto max-h-[78vh]">
        <table className="table">
          <thead>
            <tr>{th("ad", "Ad", "sticky left-0 bg-elev z-10")}{th("strat", "Strategist", "")}{th("first", "Launched", "")}{th("spend", "Spend")}{groups.map((g) => <th key={g.n} colSpan={g.c} className="text-center border-l border-line">{g.n}</th>)}{th("stage", "Stage", "")}</tr>
            <tr>{vis.map((c, i) => <th key={c[0]} className={`num ${i === 0 || vis[i - 1][2] !== c[2] ? "border-l border-line" : ""}`} onClick={() => { if (sort === c[0]) setDir(dir === 1 ? -1 : 1); else { setSort(c[0]); setDir(-1); } }} style={{ cursor: "pointer" }}>{c[1]}{sort === c[0] ? (dir < 0 ? " ▾" : " ▴") : ""}</th>)}</tr>
          </thead>
          <tbody>
            {list.slice(0, limit).map(({ ad, m }) => (
              <Fragment key={ad.adId}>
                <tr className={open === ad.adId ? "bg-hover" : ""}>
                  <td className="sticky left-0 bg-panel z-10 min-w-[300px] max-w-[420px] whitespace-normal">
                    <div className="flex gap-2.5 items-center">
                      <button className="h-10 w-10 rounded-md bg-hover border border-line shrink-0 grid place-items-center text-xs text-mute" onClick={() => setOpen(open === ad.adId ? null : ad.adId)} title="Details">{ad.format === "Video" ? "▶" : "▣"}</button>
                      <div className="min-w-0">
                        <div className="font-medium leading-snug text-ink line-clamp-2" title={ad.adName}>{ad.taxonomy.name ? `${ad.taxonomy.angle} · ${ad.taxonomy.name}` : ad.adName}</div>
                        <div className="text-[11px] text-mute mt-0.5 flex flex-wrap gap-1 items-center">
                          {ad.taxonomy.awareness && <span className="pill pill-mute">{ad.taxonomy.awareness}</span>}{ad.taxonomy.type && <span className="pill pill-mute">{ad.taxonomy.type}</span>}{ad.taxonomy.product && <span className="pill pill-mute">{ad.taxonomy.product}</span>}
                          <span className={ad.status === "ACTIVE" ? "text-good" : ""}>{ad.status}</span>
                          {!ad.valid && <span className="text-warn">name doesn&apos;t follow SOP</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-dim whitespace-nowrap"><span className="inline-block h-2 w-2 rounded-sm mr-1.5 align-middle" style={{ background: ad.strategist === UNASSIGNED ? "var(--text-mute)" : undefined }} />{nameOf(ad.strategist)}</td>
                  <td className="text-dim whitespace-nowrap">{fmtD(ad.launchedAt)}</td>
                  <td className="num">{fmtMoney(m.spend)}<div className="h-1 bg-hover rounded-full mt-1"><div className="h-full bg-info/70 rounded-full" style={{ width: `${(m.spend / maxSpend) * 100}%` }} /></div></td>
                  {vis.map((c) => { const [cls, body] = cellBody(c[0], m); return <td key={c[0]} className={cls}>{body}</td>; })}
                  <td><StageChip s={m.stage} /></td>
                </tr>
                {open === ad.adId && (
                  <tr><td colSpan={vis.length + 5} className="bg-elev text-xs text-dim whitespace-normal">
                    <div className="grid md:grid-cols-4 gap-x-6 gap-y-1">
                      <div><span className="label">Ad name</span><div>{ad.adName}</div></div><div><span className="label">Ad set</span><div>{ad.adSetName}</div></div><div><span className="label">Campaign</span><div>{ad.campaignName}</div></div>
                      <div><span className="label">In range</span><div>{fmtN(m.imp)} impressions · {fmtN(m.linkClicks)} link clicks · {fmtN(m.v3)} 3s plays · {fmtN(m.thru)} thruplays</div></div>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > limit && <div className="text-center py-3 text-xs text-mute">Showing {limit} of {list.length} · <button className="text-gold-soft hover:underline" onClick={() => setLimit(limit + 40)}>Show 40 more</button></div>}
    </Card>
  );
}

/* ------------------------------------------------------------------------- */
/*  Charts                                                                   */
/* ------------------------------------------------------------------------- */

function TrendChart({ ads, range, rules, keys, colorOf, nameOf, filterOk }: { ads: AdRecord[]; range: [string, string]; rules: CreativeRules; keys: string[]; colorOf: (k: string) => string; nameOf: (k: string) => string; filterOk: (a: AdRecord) => boolean }) {
  const bk = buckets(range[0], range[1]);
  const data = bk.map((b) => {
    const row: Record<string, number | string> = { label: b.label };
    for (const k of keys) {
      const items = ads.filter((a) => a.strategist === k && filterOk(a)).map((a) => aggregate(a, b.d1, b.d2, rules, null)).filter((m) => m.active && m.stage !== "untested");
      row[k] = items.length ? items.filter((m) => m.stage === "winner").length / items.length : 0;
      row[`${k}_n`] = items.length;
    }
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" minTickGap={30} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} width={40} axisLine={false} tickLine={false} domain={[0, 1]} />
        <Tooltip formatter={(v, name) => [`${Math.round(Number(v) * 100)}%`, nameOf(String(name))]} />
        {keys.map((k) => <Line key={k} type="monotone" dataKey={k} name={k} stroke={colorOf(k)} strokeWidth={1.75} dot={false} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ScatterPanel({ items, rules }: { items: Item[]; rules: CreativeRules }) {
  const data = items.filter((x) => x.m.stage !== "untested").map((x) => ({ x: x.m.spend, y: x.m.ncRoas, z: x.m.nc, name: x.ad.taxonomy.name ?? x.ad.adName, stage: x.m.stage }));
  const col = (s: Stage) => (s === "winner" ? "#7fb88a" : s === "potential" ? "#d9a853" : "#d66b6b");
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid />
        <XAxis dataKey="x" name="Spend" tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} axisLine={false} tickLine={false} />
        <YAxis dataKey="y" name="NC ROAS" tickFormatter={(v) => `${Number(v).toFixed(1)}×`} width={44} axisLine={false} tickLine={false} />
        <ZAxis dataKey="z" range={[30, 200]} />
        <Tooltip formatter={(v, n) => (n === "Spend" ? fmtMoney(Number(v)) : fmtX(Number(v)))} />
        {(["winner", "potential", "loser"] as Stage[]).map((s) => <Scatter key={s} data={data.filter((d) => d.stage === s)} fill={col(s)} isAnimationActive={false} />)}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function KpiChart({ items, range, rules, metric, setMetric, ads, strat, filterOk }: { items: Item[]; range: [string, string]; rules: CreativeRules; metric: "spend" | "ncRoas" | "hit" | "nc"; setMetric: (m: "spend" | "ncRoas" | "hit" | "nc") => void; ads: AdRecord[]; strat: string | null; filterOk: (a: AdRecord) => boolean }) {
  void items;
  const bk = buckets(range[0], range[1]);
  const data = bk.map((b) => {
    const ms = ads.filter((a) => (!strat || a.strategist === strat) && filterOk(a)).map((a) => aggregate(a, b.d1, b.d2, rules, null)).filter((m) => m.active);
    const s = summarize(ms.map((m) => ({ m })));
    return { label: b.label, spend: s.spend, ncRoas: s.ncRoas, hit: s.hit, nc: s.nc };
  });
  const labels = { spend: "Spend", ncRoas: "NC ROAS", hit: "Hit rate", nc: "NC purchases" };
  const fmt = (v: number) => (metric === "spend" ? fmtMoney(v) : metric === "ncRoas" ? fmtX(v) : metric === "hit" ? fmtPct(v) : fmtN(v));
  return (
    <Card title={<span className="flex items-center gap-2">{labels[metric]} over time <span className="text-mute font-normal text-xs">per {bk.length && bk[0].d1 === bk[0].d2 ? "day" : "week"}</span></span>} actions={<div className="flex gap-1">{(Object.keys(labels) as (typeof metric)[]).map((k) => <button key={k} className={`pill ${metric === k ? "pill-gold" : "pill-mute"}`} onClick={() => setMetric(k)}>{labels[k]}</button>)}</div>}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" minTickGap={30} axisLine={false} tickLine={false} />
          <YAxis width={48} axisLine={false} tickLine={false} tickFormatter={(v) => (metric === "spend" ? `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : metric === "hit" ? `${Math.round(v * 100)}%` : metric === "ncRoas" ? `${Number(v).toFixed(1)}×` : String(v))} />
          <Tooltip formatter={(v) => fmt(Number(v))} />
          {metric === "ncRoas" && <Line type="monotone" dataKey={() => rules.winRoas} name="Winner line" stroke="var(--text-mute)" strokeDasharray="4 4" dot={false} isAnimationActive={false} />}
          <Line type="monotone" dataKey={metric} name={labels[metric]} stroke="#c9a961" strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

/* ------------------------------------------------------------------------- */
/*  Creative Output (ClickUp)                                                */
/* ------------------------------------------------------------------------- */

function OutputView({ tasks, range, prevRange, nameOf }: { tasks: CreativeTask[]; range: [string, string]; prevRange: [string, string] | null; nameOf: (k: string) => string }) {
  if (tasks.length === 0) return <Card><p className="text-sm text-mute py-6 text-center">No ClickUp data yet. Connect ClickUp on the Connections page to see the brief pipeline here.</p></Card>;
  const O = outputStats(tasks, range[0], range[1]);
  const OP = prevRange ? outputStats(tasks, prevRange[0], prevRange[1]) : null;
  const fD = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} d`);
  const step = (lbl: string, v: ReactNode, desc: string, cls = "", delta?: ReactNode) => <div className={`p-4 border-r border-line last:border-r-0 ${cls}`}><div className="label flex items-center">{lbl}{delta}</div><div className="text-2xl font-medium tabular-nums mt-1">{v}</div><div className="text-[11px] text-mute mt-1">{desc}</div></div>;
  const personTable = (title: string, rows: ReturnType<typeof outputStats>["byStrategist"], label: string, mapName: boolean) => (
    <Card title={title}>
      <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>{label}</th><th className="num">New briefs</th><th className="num">Brief → ready</th><th className="num">In production</th><th className="num">Ready for launch</th><th className="num">Published</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.key}><td className="text-ink whitespace-nowrap">{mapName ? nameOf(r.key) : r.key}</td><td className="num">{r.briefs}</td><td className="num">{fD(r.speed)}</td><td className="num">{r.inEdit}</td><td className="num">{r.rfl}</td><td className="num">{r.pub}</td></tr>)}
        </tbody>
      </table></div>
    </Card>
  );
  return (
    <div className="space-y-4">
      <p className="text-xs text-mute">Every number follows the date range · stages count tasks whose last update falls in it</p>
      <SectionH title="Pipeline" sub="Where the work sits, left to right · the last step is what went live" />
      <div className="card grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 overflow-hidden">
        {step("New briefs", fmtN(O.briefs), `created in For production · ${O.perWeek.toFixed(1)} per week`, "bg-good-dim/40", OP ? <Delta cur={O.briefs} prev={OP.briefs} /> : null)}
        {step("In edit", fmtN(O.inEdit), "ready for edit · moved in range")}
        {step("Pre-launch review", fmtN(O.pre), "awaiting approval · moved in range")}
        {step("Revisions", fmtN(O.rev), "back with editors · moved in range")}
        {step("Ready for launch", fmtN(O.rfl), `brief → ready ${fD(O.speed)} avg`, "bg-info-dim/40", OP ? <Delta cur={O.rfl} prev={OP.rfl} /> : null)}
        {step("Published", fmtN(O.published), "set live by the media buyer", "bg-gold-dim/40", OP ? <Delta cur={O.published} prev={OP.published} /> : null)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {personTable("By strategist", O.byStrategist, "Strategist", true)}
        {personTable("By video editor", O.byEditor, "Editor", false)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Definitions                                                              */
/* ------------------------------------------------------------------------- */

function Definitions({ rules }: { rules: CreativeRules }) {
  const dl = (rows: [string, ReactNode][]) => <dl className="space-y-2 text-sm">{rows.map(([t, d]) => <div key={t}><dt className="text-ink font-medium">{t}</dt><dd className="text-dim text-xs">{d}</dd></div>)}</dl>;
  return (
    <div className="space-y-6">
      <section><h4 className="label mb-2">Performance · Triple Whale</h4>{dl([
        ["Winner", `NC ROAS ≥ ${rules.winRoas.toFixed(2)}${rules.winCpa > 0 ? ` or NC CPA ≤ $${rules.winCpa}` : ""} over the selected dates.`],
        ["Potential", `NC ROAS ${rules.potRoas.toFixed(2)}–${(rules.winRoas - 0.01).toFixed(2)}.`],
        ["Loser", "Every other tested ad."],
        ["Tested", `At least $${rules.minSpend} spent in the selected date range. Ads under that are untested and never counted as losers.`],
        ["Hit rate", "Winners ÷ tested ads."],
        ["Launched", "Ads whose first spend day falls in the selected range."],
        ["NC · TW · Meta", "NC = new customers (Triple Whale pixel, Triple Attribution). TW = all customers. Meta = platform-reported."],
        ["Strategist", "Read from the ad name (or the ad-set name when the ad was renamed), SOP: Angle | Awareness | Name | Type | Product | Strategist. Names that don't follow it sit under Unassigned."],
      ])}</section>
      <section><h4 className="label mb-2">Strategist ranking</h4><ul className="text-xs text-dim space-y-1.5 list-disc pl-4">
        <li><b className="text-ink">Minimum sample:</b> {rules.minTested} tested ads in the range to get a rank; below that the strategist is listed under &quot;Not ranked yet&quot; with the same stats.</li>
        <li><b className="text-ink">Creative Score</b> (0–100) = ½ efficiency + ½ scale.</li>
        <li><b className="text-ink">Efficiency</b> = the strategist&apos;s NC ROAS ÷ the {rules.winRoas.toFixed(2)}× winner line, capped at 150 so a small lucky spend can&apos;t dominate.</li>
        <li><b className="text-ink">Scale</b> = share of the team&apos;s ad spend. Budget follows what works.</li>
        <li><b className="text-ink">Range under the hit rate</b> is the 90% interval (Wilson); wide = few ads. <b className="text-ink">Confidence</b>: Low under 10 tested, Medium 10–29, High 30+.</li>
        <li>Ties go to more winner spend, then more winners. Prefer 30+ day ranges. Team average uses named strategists only.</li>
      </ul></section>
      <section><h4 className="label mb-2">Creative metrics</h4>{dl([
        ["Hook rate", "3-sec views ÷ impressions (thumb-stop)."],
        ["Hold rate", "ThruPlays ÷ 3-sec views."],
        ["Link CTR", "Outbound link clicks ÷ impressions."],
        ["When judged", `Once an ad has ${rules.minImp.toLocaleString()} impressions in the range. Averages are pooled, so bigger ads weigh more.`],
        ["Colours", "Green ≥10% above the account average for the same dates · red ≥10% below · amber in between."],
        ["Weak spot", "The first funnel stage where the ad is clearly (10%+) below average: hook → retention → CTA → post-click."],
      ])}</section>
      <section><h4 className="label mb-2">Creative Output · ClickUp</h4><p className="text-xs text-dim">New briefs = tasks that entered For production in the range. Brief → ready = average days from that day to Ready for launch, over tasks that reached it in the range. Production stages = tasks sitting in that status whose last update falls in the range. Published = completed by the media buyer. A task with two editors counts once for each editor.</p></section>
    </div>
  );
}
