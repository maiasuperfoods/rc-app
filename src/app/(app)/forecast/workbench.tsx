"use client";
import { CashOverview } from "@/components/forecast/cash-chart";
import { useMemo, useState, useTransition } from "react";
import { Card, Field, Pill, fmtMoney } from "@/components/ui";
import { runForecast, runScenarios, type ForecastInputs, type ForecastResult, type LineInputs, type PoolInputs } from "@/lib/calc/forecast";
import { saveForecastInputs } from "@/app/actions";
import { Plus, Trash2 } from "lucide-react";

type Tab = "inputs" | "lines" | "cohorts" | "inventory" | "cash" | "monthly" | "scenarios" | "committed";
const TABS: [Tab, string][] = [
  ["inputs", "1 · Inputs"],
  ["lines", "2 · Lines weekly"],
  ["cohorts", "3 · Cohort engine"],
  ["inventory", "4 · Inventory & POs"],
  ["cash", "5 · Cash flow weekly"],
  ["monthly", "6 · Monthly summary"],
  ["scenarios", "7 · Ramp scenarios"],
  ["committed", "8 · Committed POs"],
];

const m0 = (n: number) => (Math.abs(n) < 0.5 ? "–" : n < 0 ? `(${fmtMoney(-n)})` : fmtMoney(n));
const n0 = (n: number) => (Math.abs(n) < 0.5 ? "–" : Math.round(n).toLocaleString());
const x2 = (n: number) => (n ? `${n.toFixed(2)}×` : "–");
const pct1 = (n: number) => (n ? `${(n * 100).toFixed(1)}%` : "–");
const uid = () => Math.random().toString(36).slice(2, 8);

export function ForecastWorkbench({ initial, isNew, tenantName, canEdit = true }: { initial: ForecastInputs; isNew: boolean; tenantName: string; canEdit?: boolean }) {
  const [inp, setInp] = useState<ForecastInputs>(initial);
  const [tab, setTab] = useState<Tab>(isNew ? "inputs" : "cash");
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const res = useMemo(() => runForecast(inp), [inp]);
  const save = () => start(async () => { await saveForecastInputs(inp); setSavedAt(new Date().toLocaleTimeString()); });

  return (
    <div className="space-y-4">
      <CashOverview res={res} inp={inp} />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([k, l]) => <button key={k} className={`btn ${tab === k ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(k)}>{l}</button>)}
        <div className="flex-1" />
        {savedAt && <span className="text-xs text-mute">Saved {savedAt}</span>}
        {canEdit && isNew && !savedAt && <Pill tone="warn">starter inputs · not saved yet</Pill>}
        {canEdit ? <button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save model"}</button> : <Pill tone="mute">read-only · changes here are not saved</Pill>}
      </div>

      {tab === "inputs" && <InputsTab inp={inp} set={setInp} />}
      {tab === "lines" && <LinesTab res={res} inp={inp} set={setInp} />}
      {tab === "cohorts" && <CohortsTab res={res} />}
      {tab === "inventory" && <InventoryTab res={res} inp={inp} />}
      {tab === "cash" && <CashTab res={res} inp={inp} />}
      {tab === "monthly" && <MonthlyTab res={res} inp={inp} />}
      {tab === "scenarios" && <ScenariosTab inp={inp} />}
      {tab === "committed" && <CommittedTab inp={inp} set={setInp} res={res} />}
      <p className="text-xs text-mute">{tenantName} · model starts {inp.startDate} · {inp.horizonWeeks} ISO weeks · rebills on 28-day cycles · all amounts in the brand&apos;s currency.</p>
    </div>
  );
}

// ---- shared week grid -------------------------------------------------------

type Row = { label: string; values: (string | number)[]; kind?: "section" | "input" | "total" | "money" | "num" | "x" | "pct"; onChange?: (i: number, v: number) => void; tone?: (v: number) => "good" | "bad" | "warn" | undefined };
function WeekGrid({ res, rows, firstCol = 260 }: { res: ForecastResult; rows: Row[]; firstCol?: number }) {
  const fmt = (r: Row, v: string | number) => {
    if (typeof v === "string") return v;
    switch (r.kind) {
      case "money": case "total": return m0(v);
      case "x": return x2(v);
      case "pct": return pct1(v);
      default: return n0(v);
    }
  };
  return (
    <div className="overflow-x-auto card">
      <table className="table" style={{ minWidth: firstCol + res.weeks.length * 92 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-panel z-10" style={{ minWidth: firstCol }}>Line</th>
            {res.weeks.map((w) => <th key={w.idx} className="num"><div>{w.isoLabel}</div><div className="text-[10px] font-normal normal-case tracking-normal text-mute">{w.start.slice(5)}</div></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={r.kind === "section" ? "bg-elev" : ""}>
              <td className={`sticky left-0 z-10 ${r.kind === "section" ? "bg-elev font-medium text-gold-soft" : r.kind === "total" ? "bg-panel font-medium" : "bg-panel text-dim"}`}>{r.label}</td>
              {r.kind === "section"
                ? <td colSpan={res.weeks.length} className="bg-elev" />
                : r.values.map((v, i) => {
                    const tone = typeof v === "number" && r.tone ? r.tone(v) : undefined;
                    return (
                      <td key={i} className={`num whitespace-nowrap ${r.kind === "total" ? "font-medium" : ""} ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : ""}`}>
                        {r.kind === "input" ? <input className="input text-right py-1 px-1 text-xs w-20" type="number" value={v === "" ? "" : (v as number)} placeholder="–" onChange={(e) => r.onChange?.(i, e.target.value === "" ? NaN : Number(e.target.value))} /> : fmt(r, v)}
                      </td>
                    );
                  })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- 1. Inputs -------------------------------------------------------------

function InputsTab({ inp, set }: { inp: ForecastInputs; set: (i: ForecastInputs) => void }) {
  const n = (v: string) => (v === "" ? 0 : Number(v));
  const p = (v: string) => n(v) / 100;
  const P = (v: number) => Math.round(v * 1000) / 10;
  const setLine = (i: number, patch: Partial<LineInputs>) => set({ ...inp, lines: inp.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setPool = (i: number, patch: Partial<PoolInputs>) => set({ ...inp, pools: inp.pools.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Cash and payment timing" hint="How money actually moves, not when it's earned.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model start (Monday)"><input className="input" type="date" value={inp.startDate} onChange={(e) => set({ ...inp, startDate: e.target.value })} /></Field>
            <Field label="Horizon (weeks)"><input className="input" type="number" value={inp.horizonWeeks} onChange={(e) => set({ ...inp, horizonWeeks: Math.max(4, Math.min(78, n(e.target.value))) })} /></Field>
            <Field label="Cash on hand at start"><input className="input" type="number" value={inp.cashOnHand} onChange={(e) => set({ ...inp, cashOnHand: n(e.target.value) })} /></Field>
            <Field label="Cash buffer (warn below)"><input className="input" type="number" value={inp.cashBuffer} onChange={(e) => set({ ...inp, cashBuffer: n(e.target.value) })} /></Field>
            <Field label="Revenue via PayPal %"><input className="input" type="number" value={P(inp.paypalShare)} onChange={(e) => set({ ...inp, paypalShare: p(e.target.value) })} /></Field>
            <Field label="PayPal rolling reserve %"><input className="input" type="number" value={P(inp.paypalReserve)} onChange={(e) => set({ ...inp, paypalReserve: p(e.target.value) })} /></Field>
            <Field label="Reserve release (weeks)" hint="60 days ≈ 9"><input className="input" type="number" value={inp.reserveReleaseWeeks} onChange={(e) => set({ ...inp, reserveReleaseWeeks: n(e.target.value) })} /></Field>
            <Field label="Payout delay (weeks)" hint="2-day processor = 0"><input className="input" type="number" value={inp.payoutDelayWeeks} onChange={(e) => set({ ...inp, payoutDelayWeeks: n(e.target.value) })} /></Field>
            <Field label="Ad spend card lag (weeks)" hint="statement + grace ≈ 5; 0 = pay as you go"><input className="input" type="number" value={inp.adSpendLagWeeks} onChange={(e) => set({ ...inp, adSpendLagWeeks: n(e.target.value) })} /></Field>
            <Field label="Card limit" hint="max unpaid ad spend the card carries"><input className="input" type="number" value={inp.cardLimit} onChange={(e) => set({ ...inp, cardLimit: n(e.target.value) })} /></Field>
            <Field label="Card cashback %"><input className="input" type="number" step="0.1" value={P(inp.cardCashback)} onChange={(e) => set({ ...inp, cardCashback: p(e.target.value) })} /></Field>
            <Field label="Refund / return rate %"><input className="input" type="number" step="0.1" value={P(inp.refundRate)} onChange={(e) => set({ ...inp, refundRate: p(e.target.value) })} /></Field>
            <Field label="Processing + chargebacks %"><input className="input" type="number" step="0.1" value={P(inp.processingRate)} onChange={(e) => set({ ...inp, processingRate: p(e.target.value) })} /></Field>
          </div>
          <div className="label mt-4 mb-1.5">Unpaid ad charges already on the card (oldest week first)</div>
          <input className="input font-mono text-sm" value={inp.preCardCharges.join(", ")} placeholder="0, 0, 0, 38000, 41000" onChange={(e) => set({ ...inp, preCardCharges: e.target.value.split(",").map((x) => Number(x.trim()) || 0) })} />
        </Card>

        <Card title="Operating expenses" hint="Fixed opex is paid in the month incurred, spread over weeks by days.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fixed opex per month"><input className="input" type="number" value={inp.fixedOpexMonthly} onChange={(e) => set({ ...inp, fixedOpexMonthly: n(e.target.value) })} /></Field>
            <Field label="Variable opex, % of ad spend"><input className="input" type="number" step="0.5" value={P(inp.variableOpexRate)} onChange={(e) => set({ ...inp, variableOpexRate: p(e.target.value) })} /></Field>
          </div>
          <div className="label mt-4 mb-1.5">Additional hires (from week · monthly cost, cumulative)</div>
          {inp.extraStrategists.map((s, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className="input w-24" type="number" value={s.fromWeek} onChange={(e) => set({ ...inp, extraStrategists: inp.extraStrategists.map((x, j) => (j === i ? { ...x, fromWeek: n(e.target.value) } : x)) })} />
              <input className="input" type="number" value={s.monthly} onChange={(e) => set({ ...inp, extraStrategists: inp.extraStrategists.map((x, j) => (j === i ? { ...x, monthly: n(e.target.value) } : x)) })} />
              <button className="text-mute hover:text-bad" onClick={() => set({ ...inp, extraStrategists: inp.extraStrategists.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => set({ ...inp, extraStrategists: [...inp.extraStrategists, { fromWeek: 6, monthly: 4000 }] })}><Plus size={14} /> Hire</button>
        </Card>

        <Card title="Retention engine (28-day cycles)" hint="Shared by every line. Fit these to your repeat data.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cycle-1 rebill rate %" hint="share of new customers rebilling at day 28"><input className="input" type="number" step="0.5" value={P(inp.cycle1Rate)} onChange={(e) => set({ ...inp, cycle1Rate: p(e.target.value) })} /></Field>
            <Field label="Cycle-to-cycle retention %"><input className="input" type="number" step="0.5" value={P(inp.retention)} onChange={(e) => set({ ...inp, retention: p(e.target.value) })} /></Field>
            <Field label="Cycle-1 rate, old cohorts %" hint="cohorts tagged 'old' in the pre-model list"><input className="input" type="number" step="0.5" value={P(inp.cycle1RateOld)} onChange={(e) => set({ ...inp, cycle1RateOld: p(e.target.value) })} /></Field>
            <Field label="Retention, old cohorts %"><input className="input" type="number" step="0.5" value={P(inp.retentionOld)} onChange={(e) => set({ ...inp, retentionOld: p(e.target.value) })} /></Field>
            <Field label="PO cadence (weeks)" hint="4 = monthly"><input className="input" type="number" value={inp.poCadenceWeeks} onChange={(e) => set({ ...inp, poCadenceWeeks: Math.max(1, n(e.target.value)) })} /></Field>
            <Field label="Safety stock (weeks)"><input className="input" type="number" value={inp.safetyWeeks} onChange={(e) => set({ ...inp, safetyWeeks: n(e.target.value) })} /></Field>
            <Field label="Supplier deposit at PO %"><input className="input" type="number" value={P(inp.depositShare)} onChange={(e) => set({ ...inp, depositShare: p(e.target.value) })} /></Field>
          </div>
        </Card>
      </div>

      <Card title="Line economics" hint="One column per product line. Ramp = daily spend from start to first target, then to second target, then weekly growth." actions={<button className="btn btn-ghost" onClick={() => set({ ...inp, lines: [...inp.lines, { ...inp.lines[0], id: `line-${uid()}`, name: "New line", rampStartWeek: 6, preCohorts: [], longTailWeekly: 0, spendOverrides: {}, unitsPerNewOrder: {}, unitsPerRebillOrder: {}, upsellPoolId: null }] })}><Plus size={14} /> Line</button>}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Input</th>{inp.lines.map((l, i) => <th key={l.id} className="num"><div className="flex items-center justify-end gap-2"><input className="input w-40 py-1" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />{inp.lines.length > 1 && <button className="text-mute hover:text-bad" onClick={() => set({ ...inp, lines: inp.lines.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}</div></th>)}</tr></thead>
            <tbody>
              {([
                ["Ramp start week (1 = first week)", "rampStartWeek", 1],
                ["Daily spend at ramp start", "dailySpendStart", 1],
                ["Daily spend at first target", "dailySpendTarget1", 1],
                ["Week the first target is reached", "target1Week", 1],
                ["Daily spend at second target", "dailySpendTarget2", 1],
                ["Week the second target is reached", "target2Week", 1],
                ["Weekly growth in daily spend after the last target %", "weeklyGrowthAfter", 100],
                ["New-customer ROAS at ramp start", "roasStart", 1],
                ["New-customer ROAS at scale", "roasScale", 1],
                ["Week ROAS reaches the at-scale value", "roasScaleWeek", 1],
                ["First-order AOV (incl. upsell contribution)", "firstOrderAov", 1],
                ["Upsell take rate %", "upsellTakeRate", 100],
                ["Upsell price", "upsellPrice", 1],
                ["Upsell units per upsell order", "upsellUnitsPerOrder", 1],
                ["Fulfillment cost per new order", "fulfillmentNew", 1],
                ["Revenue per rebill order", "rebillRevenue", 1],
                ["Fulfillment cost per rebill order", "fulfillmentRebill", 1],
                ["Long-tail rebill revenue per week at start", "longTailWeekly", 1],
                ["Weekly decay of that tail %", "longTailDecay", 100],
              ] as [string, keyof LineInputs, number][]).map(([label, key, mult]) => (
                <tr key={key}><td className="text-dim">{label}</td>{inp.lines.map((l, i) => <td key={l.id} className="num w-44"><input className="input text-right py-1" type="number" step={mult === 100 ? 0.5 : key.startsWith("roas") ? 0.05 : 1} value={Math.round((l[key] as number) * mult * 100) / 100} onChange={(e) => setLine(i, { [key]: n(e.target.value) / mult } as Partial<LineInputs>)} /></td>)}</tr>
              ))}
              <tr><td className="text-dim">Upsell draws from pool</td>{inp.lines.map((l, i) => <td key={l.id} className="num"><select className="input py-1" value={l.upsellPoolId ?? ""} onChange={(e) => setLine(i, { upsellPoolId: e.target.value || null })}><option value="">none</option>{inp.pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>)}</tr>
              {inp.pools.map((p) => (
                <tr key={`new-${p.id}`}><td className="text-dim">Units of <span className="text-ink">{p.name}</span> per new order</td>{inp.lines.map((l, i) => <td key={l.id} className="num"><input className="input text-right py-1" type="number" step="0.1" value={l.unitsPerNewOrder[p.id] ?? 0} onChange={(e) => setLine(i, { unitsPerNewOrder: { ...l.unitsPerNewOrder, [p.id]: n(e.target.value) } })} /></td>)}</tr>
              ))}
              {inp.pools.map((p) => (
                <tr key={`rb-${p.id}`}><td className="text-dim">Units of <span className="text-ink">{p.name}</span> per rebill order</td>{inp.lines.map((l, i) => <td key={l.id} className="num"><input className="input text-right py-1" type="number" step="0.1" value={l.unitsPerRebillOrder[p.id] ?? 0} onChange={(e) => setLine(i, { unitsPerRebillOrder: { ...l.unitsPerRebillOrder, [p.id]: n(e.target.value) } })} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="label mt-5 mb-2">Existing weekly cohorts (brands already live): weekStart, new customers, regime — one per line</div>
        <div className="grid md:grid-cols-2 gap-3">
          {inp.lines.map((l, i) => (
            <textarea key={l.id} className="input font-mono text-xs min-h-24" placeholder={`${l.name}\n2026-10-05, 380, new\n2026-09-28, 350, old`} value={l.preCohorts.map((c) => `${c.weekStart}, ${c.newCustomers}, ${c.regime}`).join("\n")} onChange={(e) => setLine(i, { preCohorts: e.target.value.split("\n").map((row) => row.split(",").map((x) => x.trim())).filter((r) => r[0] && r[1]).map((r) => ({ weekStart: r[0], newCustomers: Number(r[1]) || 0, regime: r[2] === "old" ? "old" : "new" })) })} />
          ))}
        </div>
      </Card>

      <Card title="Inventory pools" hint="Units on hand at start, landed cost per unit, supplier lead time. Scheduled inbound = stock already ordered (week it lands · units)." actions={<button className="btn btn-ghost" onClick={() => set({ ...inp, pools: [...inp.pools, { id: `pool-${uid()}`, name: "New pool", onHand: 0, landedCost: 1, leadWeeks: 6, scheduledInbound: [] }] })}><Plus size={14} /> Pool</button>}>
        <table className="table">
          <thead><tr><th>Pool</th><th className="num">Units on hand</th><th className="num">Landed cost / unit</th><th className="num">Lead time (weeks)</th><th>Scheduled inbound (week:units, …)</th><th /></tr></thead>
          <tbody>
            {inp.pools.map((p, i) => (
              <tr key={p.id}>
                <td><input className="input py-1" value={p.name} onChange={(e) => setPool(i, { name: e.target.value })} /></td>
                <td className="num w-36"><input className="input text-right py-1" type="number" value={p.onHand} onChange={(e) => setPool(i, { onHand: n(e.target.value) })} /></td>
                <td className="num w-36"><input className="input text-right py-1" type="number" step="0.01" value={p.landedCost} onChange={(e) => setPool(i, { landedCost: n(e.target.value) })} /></td>
                <td className="num w-32"><input className="input text-right py-1" type="number" value={p.leadWeeks} onChange={(e) => setPool(i, { leadWeeks: n(e.target.value) })} /></td>
                <td><input className="input font-mono text-xs py-1" value={p.scheduledInbound.map((s) => `${s.week}:${s.units}`).join(", ")} placeholder="6:10000, 12:5000" onChange={(e) => setPool(i, { scheduledInbound: e.target.value.split(",").map((x) => x.split(":").map((y) => Number(y.trim()))).filter((a) => a[0] > 0 && a[1] > 0).map(([week, units]) => ({ week, units })) })} /></td>
                <td className="w-8"><button className="text-mute hover:text-bad" onClick={() => set({ ...inp, pools: inp.pools.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---- 2. Lines weekly ---------------------------------------------------------

function LinesTab({ res, inp, set }: { res: ForecastResult; inp: ForecastInputs; set: (i: ForecastInputs) => void }) {
  const rows: Row[] = [
    { label: "Model week #", values: res.weeks.map((w) => w.idx) },
    { label: "Week start (Monday)", values: res.weeks.map((w) => w.start) },
    { label: "Active days", values: res.weeks.map((w) => w.activeDays) },
  ];
  res.lines.forEach((l, li) => {
    const inputs = inp.lines[li];
    rows.push({ label: l.name, values: [], kind: "section" });
    rows.push({ label: "Daily ad spend — formula ramp", values: l.weeks.map((w) => w.dailySpendFormula), kind: "money" });
    rows.push({ label: "Daily spend override (type to replace)", values: l.weeks.map((w) => (inputs.spendOverrides[w.idx] != null ? inputs.spendOverrides[w.idx] : "")), kind: "input", onChange: (i, v) => { const o = { ...inputs.spendOverrides }; if (Number.isNaN(v)) delete o[i + 1]; else o[i + 1] = v; set({ ...inp, lines: inp.lines.map((x, j) => (j === li ? { ...x, spendOverrides: o } : x)) }); } });
    rows.push({ label: "Daily ad spend used", values: l.weeks.map((w) => w.dailySpend), kind: "money" });
    rows.push({ label: "Weekly ad spend (daily × active days)", values: l.weeks.map((w) => w.spend), kind: "total" });
    rows.push({ label: "New-customer ROAS", values: l.weeks.map((w) => w.roas), kind: "x" });
    rows.push({ label: "New-customer first-order revenue", values: l.weeks.map((w) => w.ncRevenue), kind: "money" });
    rows.push({ label: "New orders (new customers)", values: l.weeks.map((w) => w.newOrders), kind: "num" });
    rows.push({ label: "Rebill orders — cohorts acquired in the model", values: l.weeks.map((w) => w.rebillModel), kind: "num" });
    rows.push({ label: "Rebill orders — earlier cohorts", values: l.weeks.map((w) => w.rebillPre), kind: "num" });
    rows.push({ label: "Rebill orders (total)", values: l.weeks.map((w) => w.rebills), kind: "num" });
    rows.push({ label: "Long-tail rebill revenue", values: l.weeks.map((w) => w.longTail), kind: "money" });
    rows.push({ label: "Rebill revenue", values: l.weeks.map((w) => w.rebillRevenue), kind: "money" });
    rows.push({ label: "Total revenue", values: l.weeks.map((w) => w.revenue), kind: "total" });
    rows.push({ label: "Fulfillment cost", values: l.weeks.map((w) => w.fulfillment), kind: "money" });
    for (const p of res.pools) if (l.weeks.some((w) => (w.demand[p.id] ?? 0) > 0)) rows.push({ label: `Demand: ${p.name}`, values: l.weeks.map((w) => w.demand[p.id] ?? 0), kind: "num" });
  });
  rows.push({ label: "Totals", values: [], kind: "section" });
  rows.push({ label: "Ad spend (all lines)", values: res.cash.map((c) => c.adCharged), kind: "total" });
  rows.push({ label: "Revenue (all lines)", values: res.cash.map((c) => c.revenue), kind: "total" });
  return (
    <div className="space-y-3">
      <Card title="Weekly build by line" hint="Ad spend ramp, new customers, 28-day rebills, revenue, fulfillment and unit demand. Type a daily spend into the override row to replace the formula for that week." />
      <WeekGrid res={res} rows={rows} />
    </div>
  );
}

// ---- 3. Cohort engine --------------------------------------------------------

function CohortsTab({ res }: { res: ForecastResult }) {
  const [lineId, setLineId] = useState(res.lines[0]?.id ?? "");
  const line = res.lines.find((l) => l.id === lineId) ?? res.lines[0];
  if (!line) return null;
  const cohorts = [...line.cohorts].sort((a, b) => a.idx - b.idx);
  const totalsPre = res.weeks.map((w) => cohorts.filter((c) => c.idx < 1).reduce((a, c) => a + c.rebills[w.idx - 1], 0));
  const totalsModel = res.weeks.map((w) => cohorts.filter((c) => c.idx >= 1).reduce((a, c) => a + c.rebills[w.idx - 1], 0));
  return (
    <div className="space-y-3">
      <Card title={`Cohort engine — ${line.name}`} hint="Rebill orders by acquisition week (rows) × calendar week (columns). Cell = cohort new customers × cycle-1 rate × retention^(cycle−1) on weeks that are an exact multiple of 4 after acquisition." actions={<select className="input w-56" value={lineId} onChange={(e) => setLineId(e.target.value)}>{res.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>} />
      <div className="overflow-x-auto card">
        <table className="table" style={{ minWidth: 520 + res.weeks.length * 64 }}>
          <thead><tr><th className="sticky left-0 bg-panel z-10">Cohort week start</th><th className="num">Idx</th><th className="num">New customers</th><th>Regime</th>{res.weeks.map((w) => <th key={w.idx} className="num">{w.isoLabel}</th>)}</tr></thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.weekStart}>
                <td className="sticky left-0 bg-panel z-10 text-dim">{c.weekStart}</td><td className="num text-mute">{c.idx < 1 ? `(${1 - c.idx})` : c.idx}</td><td className="num">{n0(c.newCustomers)}</td><td><Pill tone={c.regime === "old" ? "mute" : "info"}>{c.regime}</Pill></td>
                {c.rebills.map((v, i) => <td key={i} className={`num ${v ? "" : "text-mute"}`}>{n0(v)}</td>)}
              </tr>
            ))}
            <tr><td className="sticky left-0 bg-panel z-10 font-medium">Rebills from earlier cohorts</td><td /><td /><td />{totalsPre.map((v, i) => <td key={i} className="num font-medium">{n0(v)}</td>)}</tr>
            <tr><td className="sticky left-0 bg-panel z-10 font-medium">Rebills from model cohorts</td><td /><td /><td />{totalsModel.map((v, i) => <td key={i} className="num font-medium">{n0(v)}</td>)}</tr>
            <tr><td className="sticky left-0 bg-panel z-10 font-medium text-gold-soft">Total rebill orders</td><td /><td /><td />{totalsPre.map((v, i) => <td key={i} className="num font-medium text-gold-soft">{n0(v + totalsModel[i])}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- 4. Inventory & POs ------------------------------------------------------

function InventoryTab({ res, inp }: { res: ForecastResult; inp: ForecastInputs }) {
  const rows: Row[] = [{ label: "Model week #", values: res.weeks.map((w) => w.idx) }, { label: "Week start", values: res.weeks.map((w) => w.start) }];
  for (const p of res.pools) {
    const pi = inp.pools.find((x) => x.id === p.id)!;
    rows.push({ label: p.name, values: [], kind: "section" });
    rows.push({ label: "Demand (units shipped)", values: p.weeks.map((w) => w.demand), kind: "num" });
    rows.push({ label: "Cumulative demand", values: p.weeks.map((w) => w.cumDemand), kind: "num" });
    rows.push({ label: "Scheduled inbound (already ordered)", values: p.weeks.map((w) => w.inbound), kind: "num" });
    rows.push({ label: "Cumulative scheduled inbound", values: p.weeks.map((w) => w.cumInbound), kind: "num" });
    rows.push({ label: `PO units to place (covers until next PO lands + ${inp.safetyWeeks} wk safety)`, values: p.weeks.map((w) => w.poUnits), kind: "num" });
    rows.push({ label: "Closing on hand (on hand + inbound + POs landed − demand)", values: p.weeks.map((w) => w.closing), kind: "num", tone: (v) => (v < 0 ? "bad" : v < pi.leadWeeks * 0 + 1 ? "warn" : undefined) });
    rows.push({ label: `Cash out: ${Math.round(inp.depositShare * 100)}% deposit now + balance on landing`, values: p.weeks.map((w) => w.cashOut), kind: "money" });
  }
  rows.push({ label: "Totals", values: [], kind: "section" });
  rows.push({ label: "Total inventory purchase cash", values: res.cash.map((c) => c.inventory), kind: "total" });
  rows.push({ label: "PO value placed this week (for reference)", values: res.weeks.map((w) => res.pools.reduce((a, p) => a + p.weeks[w.idx - 1].poUnits * (inp.pools.find((x) => x.id === p.id)?.landedCost ?? 0), 0)), kind: "money" });
  return (
    <div className="space-y-3">
      <Card title="Inventory pools: demand, inbound, POs and cash out" hint={`POs are placed every ${inp.poCadenceWeeks} weeks. PO units = max(0, demand until the next PO lands − stock on hand − inbound). ${Math.round(inp.depositShare * 100)}% is paid at PO, the balance when it lands.`} />
      <WeekGrid res={res} rows={rows} firstCol={320} />
    </div>
  );
}

// ---- 5. Cash flow weekly -----------------------------------------------------

function CashTab({ res, inp }: { res: ForecastResult; inp: ForecastInputs }) {
  const c = res.cash;
  const rows: Row[] = [
    { label: "Model week #", values: res.weeks.map((w) => w.idx) },
    { label: "Week start (Monday)", values: res.weeks.map((w) => w.start) },
    { label: "Cash in", values: [], kind: "section" },
    { label: "Revenue (all lines)", values: c.map((x) => x.revenue), kind: "money" },
    { label: "Net receipts before timing (revenue × (1 − refunds − processing))", values: c.map((x) => x.netReceipts), kind: "money" },
    { label: "PayPal reserve held this week", values: c.map((x) => -x.reserveHeld), kind: "money" },
    { label: `PayPal reserve released (from ${inp.reserveReleaseWeeks} weeks earlier)`, values: c.map((x) => x.reserveReleased), kind: "money" },
    { label: "Payouts received (after payout delay)", values: c.map((x) => x.payouts), kind: "total" },
    { label: "Ad spend and the card", values: [], kind: "section" },
    { label: "Ad spend charged to the card (all lines)", values: c.map((x) => x.adCharged), kind: "money" },
    { label: "Unpaid ad spend on the card, end of week (capped at the limit)", values: c.map((x) => x.cardBalance), kind: "money", tone: (v) => (inp.cardLimit && v >= inp.cardLimit - 1 ? "warn" : undefined) },
    { label: "Ad spend paid in cash", values: c.map((x) => -x.adPaid), kind: "money" },
    { label: "Card cashback received", values: c.map((x) => x.cashback), kind: "money" },
    { label: "Other cash out", values: [], kind: "section" },
    { label: "Inventory purchases (deposits + balances on new POs)", values: c.map((x) => -x.inventory), kind: "money" },
    { label: "Committed supplier balances + freight (tab 8)", values: c.map((x) => -x.committed), kind: "money" },
    { label: "Fulfillment (3PL, paid as shipped)", values: c.map((x) => -x.fulfillment), kind: "money" },
    { label: "Fixed opex + hires (monthly amount spread by days)", values: c.map((x) => -x.fixedOpex), kind: "money" },
    { label: `Variable opex (${Math.round(inp.variableOpexRate * 100)}% of ad spend)`, values: c.map((x) => -x.variableOpex), kind: "money" },
    { label: "Balance", values: [], kind: "section" },
    { label: "Net cash flow", values: c.map((x) => x.net), kind: "total", tone: (v) => (v < 0 ? "bad" : "good") },
    { label: "Closing cash", values: c.map((x) => x.closing), kind: "total", tone: (v) => (v < 0 ? "bad" : v < inp.cashBuffer ? "warn" : undefined) },
    { label: "Below buffer?", values: c.map((x) => (x.belowBuffer ? "yes" : "–")) },
    { label: "Card at its limit?", values: c.map((x) => (x.cardAtLimit && inp.cardLimit > 0 ? "yes" : "–")) },
    { label: "PayPal reserve outstanding (cash you are owed)", values: c.map((x) => x.reserveOutstanding), kind: "money" },
  ];
  return (
    <div className="space-y-3">
      <WeekGrid res={res} rows={rows} firstCol={340} />
    </div>
  );
}

// ---- 6. Monthly summary ------------------------------------------------------

function MonthlyTab({ res, inp }: { res: ForecastResult; inp: ForecastInputs }) {
  const M = res.months;
  const lines = res.lines;
  const row = (label: string, f: (m: (typeof M)[number]) => string | number, cls = "") => (
    <tr key={label}><td className={`text-dim ${cls}`}>{label}</td>{M.map((m) => { const v = f(m); return <td key={m.month} className={`num ${cls}`}>{typeof v === "number" ? m0(v) : v}</td>; })}</tr>
  );
  const section = (label: string) => <tr key={label} className="bg-elev"><td className="font-medium text-gold-soft">{label}</td><td colSpan={M.length} /></tr>;
  return (
    <div className="space-y-3">
      <Card title="Monthly view: P&L (accrual) and cash" hint="Weeks are allocated to months by active days. Operating profit and cash diverge because of the card float, the PayPal reserve, inventory deposits and the first month's unpaid charges." />
      <div className="overflow-x-auto card">
        <table className="table">
          <thead><tr><th>Line</th>{M.map((m) => <th key={m.month} className="num">{m.month}</th>)}</tr></thead>
          <tbody>
            {row("Days in month", (m) => String(m.days))}
            {section("Ad spend and customers")}
            {lines.map((l) => row(`Ad spend — ${l.name}`, (m) => m.spendByLine[l.id]))}
            {row("Ad spend — total", (m) => m.spend, "font-medium")}
            {row("Ad spend per day", (m) => m.spendPerDay)}
            {lines.map((l) => row(`New customers — ${l.name}`, (m) => n0(m.newCustomersByLine[l.id])))}
            {row("New customers — total", (m) => n0(m.newCustomers), "font-medium")}
            {lines.map((l) => row(`New-customer first-order revenue — ${l.name}`, (m) => m.ncRevenueByLine[l.id]))}
            {lines.map((l) => row(`NC ROAS — ${l.name}`, (m) => x2(m.ncRoasByLine[l.id])))}
            {row("NC ROAS — blended (all lines)", (m) => x2(m.ncRoas), "font-medium")}
            {lines.map((l) => row(`CAC — ${l.name}`, (m) => (m.cacByLine[l.id] ? fmtMoney(m.cacByLine[l.id], 2) : "–")))}
            {section("P&L (accrual)")}
            {lines.map((l) => row(`Revenue — ${l.name}`, (m) => m.revenueByLine[l.id]))}
            {row("Revenue — total", (m) => m.revenue, "font-medium")}
            {row("Blended ROAS (total revenue ÷ total spend)", (m) => x2(m.blendedRoas))}
            {row("Returning revenue share", (m) => pct1(m.returningShare))}
            {row("Refunds + processing", (m) => -m.refundsProcessing)}
            {row("COGS (units shipped × landed cost)", (m) => -m.cogs)}
            {row("Fulfillment", (m) => -m.fulfillment)}
            {row("Ad spend", (m) => -m.spend)}
            {row("Contribution margin", (m) => m.contribution, "font-medium")}
            {row("Additional hires ($/month, cumulative)", (m) => m.strategists)}
            {row(`Opex (fixed + hires + ${Math.round(inp.variableOpexRate * 100)}% of spend)`, (m) => -m.opex)}
            {row("Operating profit", (m) => m.operatingProfit, "font-medium")}
            {row("Operating margin %", (m) => pct1(m.operatingMargin))}
            {section("Cash")}
            {row("Payouts received", (m) => m.payouts)}
            {row("Ad spend paid in cash", (m) => -m.adPaid)}
            {row("Inventory purchases", (m) => -m.inventory)}
            {row("Committed supplier balances + freight", (m) => -m.committed)}
            {row("Fulfillment", (m) => -m.fulfillment)}
            {row("Opex", (m) => -m.cashOpex)}
            {row("Card cashback", (m) => m.cashback)}
            {row("Net cash flow", (m) => m.netCash, "font-medium")}
            {row("Cash at month end (last week ending in the month)", (m) => m.cashEnd, "font-medium")}
            {row("Lowest weekly cash in the month", (m) => m.lowestCash)}
            {row("Unpaid card balance at month end", (m) => m.cardEnd)}
            {row("PayPal reserve outstanding at month end", (m) => m.reserveEnd)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- 7. Ramp scenarios -------------------------------------------------------

function ScenariosTab({ inp }: { inp: ForecastInputs }) {
  const [lineId, setLineId] = useState(inp.lines[0]?.id ?? "");
  const sc = useMemo(() => runScenarios(inp, lineId), [inp, lineId]);
  const line = inp.lines.find((l) => l.id === lineId) ?? inp.lines[0];
  if (!line) return null;
  const payments = [...new Set(sc.reach.flat().map((r) => r.payment))];
  return (
    <div className="space-y-3">
      <Card title="Ramp scenarios" hint={`Each cell re-runs the whole model with three levers changed for ${line.name}: the week the second target (${fmtMoney(line.dailySpendTarget2)}/day) is reached, the at-scale new-customer ROAS, and how ad spend is paid. Lowest cash balance across the horizon; red means you run out.`} actions={<select className="input w-56" value={lineId} onChange={(e) => setLineId(e.target.value)}>{inp.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>} />
      {payments.map((pay) => (
        <Card key={pay} title={`Lowest cash · ad spend ${pay}`}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Second target reached in</th>{sc.roasLabels.map((r) => <th key={r} className="num">ROAS {r}</th>)}<th className="num">Cash at end · {sc.roasLabels[0]}</th></tr></thead>
              <tbody>
                {sc.reach.map((row, i) => {
                  const cells = row.filter((r) => r.payment === pay);
                  return (
                    <tr key={i}>
                      <td className="text-dim">{sc.reachLabels[i]}{inp.lines.find((l) => l.id === lineId)?.target2Week && sc.reachLabels[i] === sc.reachLabels[2] ? <span className="text-mute"> · base</span> : null}</td>
                      {cells.map((c, j) => <td key={j} className={`num ${c.minCash < 0 ? "text-bad" : c.minCash < inp.cashBuffer ? "text-warn" : "text-good"}`}>{m0(c.minCash)}<div className="text-[10px] text-mute">{c.minCashWeek.slice(5)}</div></td>)}
                      <td className="num">{m0(cells[0]?.cashEnd ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      <p className="text-xs text-mute">Read: a later second target or a higher ROAS lifts the floor; a card with a real limit lets you scale on the float. Prefer the pay-as-you-go row when deciding whether a plan self-funds.</p>
    </div>
  );
}

// ---- 8. Committed POs --------------------------------------------------------

function CommittedTab({ inp, set, res }: { inp: ForecastInputs; set: (i: ForecastInputs) => void; res: ForecastResult }) {
  const n = (v: string) => (v === "" ? 0 : Number(v));
  const total = inp.committed.reduce((a, c) => a + c.amount, 0);
  return (
    <Card title="Committed supplier balances and freight" hint={`Payments already owed on stock that is on the way (the 'scheduled inbound' on tab 4). Total ${fmtMoney(total)}. Week 1 = ${res.weeks[0]?.start}.`} actions={<button className="btn btn-ghost" onClick={() => set({ ...inp, committed: [...inp.committed, { week: 2, amount: 0, what: "" }] })}><Plus size={14} /> Payment</button>}>
      <table className="table">
        <thead><tr><th>Model week</th><th>Pay date (Monday)</th><th className="num">Amount</th><th>What</th><th /></tr></thead>
        <tbody>
          {inp.committed.map((c, i) => (
            <tr key={i}>
              <td className="w-28"><input className="input py-1 text-right" type="number" value={c.week} onChange={(e) => set({ ...inp, committed: inp.committed.map((x, j) => (j === i ? { ...x, week: n(e.target.value) } : x)) })} /></td>
              <td className="text-dim">{res.weeks[c.week - 1]?.start ?? "beyond horizon"}</td>
              <td className="num w-40"><input className="input py-1 text-right" type="number" value={c.amount} onChange={(e) => set({ ...inp, committed: inp.committed.map((x, j) => (j === i ? { ...x, amount: n(e.target.value) } : x)) })} /></td>
              <td><input className="input py-1" value={c.what} placeholder="PO balance, sea freight + duties…" onChange={(e) => set({ ...inp, committed: inp.committed.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)) })} /></td>
              <td className="w-8"><button className="text-mute hover:text-bad" onClick={() => set({ ...inp, committed: inp.committed.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
            </tr>
          ))}
          {inp.committed.length === 0 && <tr><td colSpan={5} className="text-mute text-center py-6">Nothing committed. Add balances due on purchase orders already placed.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

