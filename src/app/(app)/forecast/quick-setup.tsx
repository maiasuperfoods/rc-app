"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { ForecastInputs, LineInputs, PoolInputs } from "@/lib/calc/forecast";
import { applyActuals, type ForecastActuals, type Sourced } from "@/lib/calc/forecast-actuals";

/**
 * The short way into the forecast. Everything the connected store can supply is already filled in
 * and says where it came from; the handful of things only the student knows are the bold,
 * gold-edged fields. The full model, with every assumption, stays one click away under All inputs.
 */

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.005, Math.abs(b) * 0.005);

function Row({ label, help, mine, source, drift, children }: { label: string; help?: string; mine: boolean; source?: string; drift?: ReactNode; children: ReactNode }) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_150px] items-center gap-x-4 gap-y-1 px-4 py-3 border-t border-line first:border-t-0 ${mine ? "bg-gold-dim border-l-2 border-l-gold" : ""}`}>
      <div className="min-w-0">
        <div className={mine ? "text-sm font-semibold text-ink" : "text-sm text-dim"}>
          {label}
          {mine && <span className="ml-2 align-middle text-[10px] uppercase tracking-wider font-semibold text-gold">your input</span>}
        </div>
        {help && <div className="text-xs text-mute mt-0.5">{help}</div>}
        {!mine && source && <div className="text-xs text-mute mt-0.5">From {source}{drift}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Num({ value, onChange, mine, step, prefix, suffix, disabled, label }: { value: number; onChange: (v: number) => void; mine: boolean; step?: number; prefix?: string; suffix?: string; disabled?: boolean; label: string }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute text-sm pointer-events-none">{prefix}</span>}
      <input
        className={`input text-right tabular-nums w-full ${prefix ? "pl-6" : ""} ${suffix ? "pr-9" : ""} ${mine ? "font-semibold border-gold" : "text-dim"}`}
        type="number"
        step={step ?? 1}
        aria-label={label}
        disabled={disabled}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mute text-xs pointer-events-none">{suffix}</span>}
    </div>
  );
}

export function QuickSetup({ inp, set, actuals, canEdit }: { inp: ForecastInputs; set: (i: ForecastInputs) => void; actuals: ForecastActuals; canEdit: boolean }) {
  const line = inp.lines[0];
  if (!line) return null;
  const setLine = (patch: Partial<LineInputs>) => set({ ...inp, lines: inp.lines.map((l, i) => (i === 0 ? { ...l, ...patch } : l)) });
  const setPool = (i: number, patch: Partial<PoolInputs>) => set({ ...inp, pools: inp.pools.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const pct = (v: number) => Math.round(v * 1000) / 10;

  /** "Store now says X · Use" when a saved value has drifted from what the store reports. */
  const drift = (current: number, a: Sourced<number> | null, show: (v: number) => string, apply: (v: number) => void) =>
    a && !close(current, a.value) ? (
      <>
        {" · now "}<span className="text-ink">{show(a.value)}</span>{" "}
        {canEdit && <button type="button" className="text-gold-soft hover:underline" onClick={() => apply(a.value)}>use</button>}
      </>
    ) : null;

  const money = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const connected = actuals.days > 0;
  const targetWeeks = Math.max(1, line.target1Week - line.rampStartWeek);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex-1 min-w-60">
          <div className="text-sm text-ink font-medium">{connected ? "Most of this is already filled in from your store." : "Connect your store and most of this fills itself in."}</div>
          <p className="text-sm text-dim mt-0.5">
            The <span className="font-semibold text-ink bg-gold-dim px-1 rounded">bold, gold fields</span> are the things only you can tell us. Everything else {connected ? "comes from your connected data and updates when you refresh" : "is a placeholder until Shopify and Triple Whale are connected"}.
          </p>
        </div>
        {canEdit && connected && (
          <button type="button" className="btn btn-secondary" onClick={() => set(applyActuals(inp, actuals))} title="Replace every store-supplied number with the latest from your connected data. Your own inputs are not touched.">
            <RefreshCw size={14} /> Refresh from store
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line"><div className="title text-base">Cash and where you want to go</div><div className="text-xs text-mute">Nothing connected can know these.</div></div>
          <Row label="Cash in the bank today" help="Across the accounts you pay suppliers and ad bills from." mine>
            <Num label="Cash in the bank today" mine prefix="$" value={inp.cashOnHand} onChange={(v) => set({ ...inp, cashOnHand: v })} disabled={!canEdit} />
          </Row>
          <Row label="Lowest cash you are comfortable with" help="The forecast warns you in any week cash would fall below this." mine>
            <Num label="Cash buffer" mine prefix="$" value={inp.cashBuffer} onChange={(v) => set({ ...inp, cashBuffer: v })} disabled={!canEdit} />
          </Row>
          <Row label="Daily ad spend you want to reach" help={actuals.dailySpend ? `You are spending about ${money(actuals.dailySpend.value)} a day now.` : "Your goal, not where you are today."} mine>
            <Num label="Target daily ad spend" mine prefix="$" step={50} value={line.dailySpendTarget1} onChange={(v) => setLine({ dailySpendTarget1: v, dailySpendTarget2: v })} disabled={!canEdit} />
          </Row>
          <Row label="Weeks to get there" help="Spend rises in even steps from today to the target." mine>
            <Num label="Weeks to reach the target" mine suffix="wks" value={targetWeeks} onChange={(v) => { const w = line.rampStartWeek + Math.max(1, Math.round(v)); setLine({ target1Week: w, target2Week: w + 1, dailySpendTarget2: line.dailySpendTarget1, roasScaleWeek: w }); }} disabled={!canEdit} />
          </Row>
          <Row label="Target NC-ROAS" help={`New-customer return on ad spend once you reach your target spend. It usually falls as you scale${actuals.ncRoas ? `; today it is ${actuals.ncRoas.value.toFixed(2)}×` : ""}.`} mine>
            <Num label="Target NC-ROAS" mine step={0.05} suffix="×" value={line.roasScale} onChange={(v) => setLine({ roasScale: v, roasScaleWeek: line.target1Week })} disabled={!canEdit} />
          </Row>
          <Row label="Fixed costs per month" help="Salaries, software, rent: everything you pay whether or not you sell." mine={!actuals.fixedOpexMonthly} source={actuals.fixedOpexMonthly?.source} drift={drift(inp.fixedOpexMonthly, actuals.fixedOpexMonthly, money, (v) => set({ ...inp, fixedOpexMonthly: v }))}>
            <Num label="Fixed costs per month" mine={!actuals.fixedOpexMonthly} prefix="$" step={100} value={inp.fixedOpexMonthly} onChange={(v) => set({ ...inp, fixedOpexMonthly: v })} disabled={!canEdit} />
          </Row>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line"><div className="title text-base">How the business runs today</div><div className="text-xs text-mute">{connected ? `Read from your connected data, ${actuals.days} days of orders. Change any of them if you know better.` : "Enter these until your store is connected."}</div></div>
          <Row label="Daily ad spend today" mine={!actuals.dailySpend} source={actuals.dailySpend?.source} help={actuals.dailySpend ? undefined : "Connect Triple Whale or Meta, or type it."} drift={drift(line.dailySpendStart, actuals.dailySpend, money, (v) => setLine({ dailySpendStart: v }))}>
            <Num label="Daily ad spend today" mine={!actuals.dailySpend} prefix="$" step={50} value={line.dailySpendStart} onChange={(v) => setLine({ dailySpendStart: v })} disabled={!canEdit} />
          </Row>
          <Row label="NC-ROAS today" mine={!actuals.ncRoas} source={actuals.ncRoas?.source} help={actuals.ncRoas ? undefined : "New-customer return on ad spend. Connect Triple Whale to read it, or type it: 1.2 means $1.20 of first-order revenue per $1 of ads."} drift={drift(line.roasStart, actuals.ncRoas, (v) => `${v.toFixed(2)}×`, (v) => setLine({ roasStart: v }))}>
            <Num label="NC-ROAS today" mine={!actuals.ncRoas} step={0.05} suffix="×" value={line.roasStart} onChange={(v) => setLine({ roasStart: v })} disabled={!canEdit} />
          </Row>
          <Row label="Average order value (AOV)" mine={!actuals.aov} source={actuals.aov?.source} help={actuals.aov ? undefined : "Connect Shopify, or type what a typical order is worth."} drift={drift(line.firstOrderAov, actuals.aov, money, (v) => setLine({ firstOrderAov: v, rebillRevenue: v }))}>
            <Num label="Average order value" mine={!actuals.aov} prefix="$" step={0.5} value={line.firstOrderAov} onChange={(v) => setLine({ firstOrderAov: v, rebillRevenue: v })} disabled={!canEdit} />
          </Row>
          <Row label="Refund rate" mine={!actuals.refundRate} source={actuals.refundRate?.source} help={actuals.refundRate ? undefined : "Share of revenue you give back."} drift={drift(inp.refundRate, actuals.refundRate, (v) => `${pct(v)}%`, (v) => set({ ...inp, refundRate: v }))}>
            <Num label="Refund rate" mine={!actuals.refundRate} step={0.1} suffix="%" value={pct(inp.refundRate)} onChange={(v) => set({ ...inp, refundRate: v / 100 })} disabled={!canEdit} />
          </Row>
          <Row label="Customers who buy again" mine={!actuals.repeatRate} source={actuals.repeatRate?.source} help={actuals.repeatRate ? undefined : "Of 100 new customers, how many order a second time. Connect Lifetimely to read it."} drift={drift(inp.cycle1Rate, actuals.repeatRate, (v) => `${pct(v)}%`, (v) => set({ ...inp, cycle1Rate: v }))}>
            <Num label="Repeat purchase rate" mine={!actuals.repeatRate} step={0.5} suffix="%" value={pct(inp.cycle1Rate)} onChange={(v) => set({ ...inp, cycle1Rate: v / 100 })} disabled={!canEdit} />
          </Row>
          <Row label="Shipping and fulfillment per order" mine={!actuals.fulfillmentPerOrder} source={actuals.fulfillmentPerOrder?.source} help={actuals.fulfillmentPerOrder ? undefined : "Postage plus pick and pack. Fill in Unit Economics once and it carries over."} drift={drift(line.fulfillmentNew, actuals.fulfillmentPerOrder, money, (v) => setLine({ fulfillmentNew: v, fulfillmentRebill: v }))}>
            <Num label="Fulfillment per order" mine={!actuals.fulfillmentPerOrder} prefix="$" step={0.1} value={line.fulfillmentNew} onChange={(v) => setLine({ fulfillmentNew: v, fulfillmentRebill: v })} disabled={!canEdit} />
          </Row>
          <Row label="Payment fees" mine={!actuals.processingRate} source={actuals.processingRate?.source} help={actuals.processingRate ? undefined : "Card processing plus chargebacks, as a share of revenue. About 3.5% is typical."} drift={drift(inp.processingRate, actuals.processingRate, (v) => `${pct(v)}%`, (v) => set({ ...inp, processingRate: v }))}>
            <Num label="Payment fees" mine={!actuals.processingRate} step={0.1} suffix="%" value={pct(inp.processingRate)} onChange={(v) => set({ ...inp, processingRate: v / 100 })} disabled={!canEdit} />
          </Row>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line"><div className="title text-base">Stock</div><div className="text-xs text-mute">{actuals.pools ? "Units and cost come from Shopify. Lead time is how long your supplier takes from order to your warehouse." : "Connect Shopify and your products, units and costs appear here."}</div></div>
        <div className="overflow-x-auto">
          <table className="table" style={{ minWidth: 620 }}>
            <thead><tr><th>Product</th><th className="num">Units on hand</th><th className="num">Cost per unit, landed</th><th className="num">Supplier lead time</th></tr></thead>
            <tbody>
              {inp.pools.map((p, i) => {
                const fromStore = Boolean(actuals.pools?.value.some((x) => x.id === p.id));
                const leadMine = !(fromStore && actuals.leadTimeKnown);
                return (
                  <tr key={p.id}>
                    <td className={fromStore ? "text-dim" : "font-semibold text-ink"}>{fromStore ? p.name : <input className="input py-1 font-semibold border-gold" aria-label="Product name" value={p.name} onChange={(e) => setPool(i, { name: e.target.value })} disabled={!canEdit} />}{fromStore && <div className="text-xs text-mute">From Shopify inventory</div>}</td>
                    <td className="num w-40"><Num label="Units on hand" mine={!fromStore} value={p.onHand} onChange={(v) => setPool(i, { onHand: v })} disabled={!canEdit} /></td>
                    <td className="num w-40"><Num label="Landed cost per unit" mine={!fromStore || p.landedCost === 0} prefix="$" step={0.01} value={p.landedCost} onChange={(v) => setPool(i, { landedCost: v })} disabled={!canEdit} /></td>
                    <td className={`num w-40 ${leadMine ? "bg-gold-dim" : ""}`}><Num label="Supplier lead time in weeks" mine={leadMine} suffix="wks" value={p.leadWeeks} onChange={(v) => setPool(i, { leadWeeks: Math.max(1, Math.round(v)) })} disabled={!canEdit} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {inp.lines.length > 1 && <p className="text-xs text-mute">This setup covers your first product line, {line.name}. Your other {inp.lines.length - 1 === 1 ? "line is" : "lines are"} under All inputs.</p>}
    </div>
  );
}
