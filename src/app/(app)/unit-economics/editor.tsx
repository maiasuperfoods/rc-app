"use client";
import { useMemo, useState, useTransition } from "react";
import { Card, Field, Pill, Stat, fmtMoney, fmtPct } from "@/components/ui";
import { CashChart } from "@/components/charts";
import { FORMULAS, computeUnitEconomics, projectCashFlow, runwayMonths } from "@/lib/calc/unit-economics";
import type { CostInputs, Offer, OpexLine, Product, Sku, Upsell } from "@/lib/types";
import { saveCostInputs, saveOffers, saveOpex, saveSkus, saveUpsells } from "@/app/actions";
import { Plus, Trash2 } from "lucide-react";

type Props = { skus: Sku[]; products: Product[]; costs: CostInputs; offers: Offer[]; upsells: Upsell[]; opex: OpexLine[]; monthRevenue: number; monthSpend: number; currency: string };

const uid = () => `tmp-${Math.random().toString(36).slice(2, 9)}`;

export function UnitEconomicsEditor(p: Props) {
  const [skus, setSkus] = useState(p.skus);
  const [costs, setCosts] = useState(p.costs);
  const [offers, setOffers] = useState(p.offers);
  const [upsells, setUpsells] = useState(p.upsells);
  const [opex, setOpex] = useState(p.opex);
  const [targetMargin, setTargetMargin] = useState(0.2);
  const [cash, setCash] = useState({ startingCash: 60000, revenue: Math.round(p.monthRevenue) || 120000, spend: Math.round(p.monthSpend) || 45000, growth: 0.1, inventoryPurchase: 0 });
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [tab, setTab] = useState<"inputs" | "cash">("inputs");

  const ue = useMemo(() => computeUnitEconomics({ offers, skus, costs, upsells, opex, targetNetMarginPct: targetMargin }), [offers, skus, costs, upsells, opex, targetMargin]);
  const def = ue.offers.find((o) => offers.find((x) => x.id === o.offerId)?.isDefault) ?? ue.offers[0];

  const cashRows = useMemo(() => {
    const months: { month: string; revenue: number; adSpend: number; inventoryPurchases?: number }[] = [];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i + 1, 1));
      const g = Math.pow(1 + cash.growth, i);
      months.push({ month: m.toISOString().slice(0, 7), revenue: cash.revenue * g, adSpend: cash.spend * g, inventoryPurchases: i === 0 ? cash.inventoryPurchase : 0 });
    }
    const aov = ue.blended?.aov ?? 0;
    const cogsPerOrder = def ? def.landedCogs : 0;
    const fulfillmentPerOrder = def ? def.fulfillment : 0;
    return projectCashFlow({ startingCash: cash.startingCash, months, costs, aov, cogsPerOrder, fulfillmentPerOrder, opexMonthly: ue.opexMonthly });
  }, [cash, costs, ue, def]);
  const avgNet = cashRows.length ? cashRows.reduce((a, r) => a + r.net, 0) / cashRows.length : 0;
  const runway = runwayMonths(cash.startingCash, avgNet);

  const persist = () =>
    start(async () => {
      await Promise.all([saveSkus(skus), saveCostInputs(costs), saveOffers(offers), saveUpsells(upsells), saveOpex(opex)]);
      setSaved(new Date().toLocaleTimeString());
    });

  const n = (v: string) => (v === "" ? 0 : Number(v));
  const pct = (v: number) => Math.round(v * 1000) / 10;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="85% rule" value={ue.offers.length ? (ue.offers.every((o) => o.passesRule) ? "Pass" : `${ue.offers.filter((o) => !o.passesRule).length} failing`) : "—"} tone={ue.offers.length ? (ue.offers.every((o) => o.passesRule) ? "good" : "bad") : "neutral"} hint={`threshold ${fmtPct(costs.targetMarginRule)} gross margin`} formula={FORMULAS.grossMarginPct} />
        <Stat label="Allowable NCPA" value={fmtMoney(ue.blended?.allowableCac, 2)} hint={`keeping ${fmtPct(targetMargin)} net margin`} formula={FORMULAS.allowableCac} />
        <Stat label="Break-even CAC" value={fmtMoney(ue.blended?.breakEvenCac, 2)} hint="spend this and make nothing" formula={FORMULAS.breakEvenCac} />
        <Stat label="Blended AOV" value={fmtMoney(ue.blended?.aov, 2)} hint="offers weighted equally until orders are synced" />
      </div>

      <div className="flex items-center gap-2">
        <button className={`btn ${tab === "inputs" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("inputs")}>Margin model</button>
        <button className={`btn ${tab === "cash" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("cash")}>Cash flow</button>
        <div className="flex-1" />
        {saved && <span className="text-xs text-mute">Saved {saved}</span>}
        <button className="btn btn-primary" onClick={persist} disabled={pending}>{pending ? "Saving…" : "Save all inputs"}</button>
      </div>

      {tab === "inputs" && (
        <>
          <Card title="Per-offer margin" hint="One row per offer. Red means the offer fails the 85% rule.">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Offer</th><th className="num">Price</th><th className="num">Units</th><th className="num" title={FORMULAS.landedCogs}>Landed COGS</th><th className="num" title={FORMULAS.grossMarginPct}>Gross margin</th><th className="num" title={FORMULAS.fulfillment}>Fulfilment</th><th className="num" title={FORMULAS.processing}>Processing</th><th className="num" title={FORMULAS.refundsAndChargebacks}>Refunds</th><th className="num" title={FORMULAS.buffer}>Buffer</th><th className="num" title={FORMULAS.upsellContribution}>Upsells</th><th className="num" title={FORMULAS.contributionBeforeAds}>Before ads</th><th className="num" title={FORMULAS.allowableCac}>Allowable NCPA</th>
                  </tr>
                </thead>
                <tbody>
                  {ue.offers.map((o) => (
                    <tr key={o.offerId}>
                      <td>{o.offerName}</td>
                      <td className="num">{fmtMoney(o.price, 2)}</td>
                      <td className="num">{o.unitsShipped}</td>
                      <td className="num">{fmtMoney(o.landedCogs, 2)}</td>
                      <td className="num"><Pill tone={o.passesRule ? "good" : "bad"}>{fmtPct(o.grossMarginPct, 1)}</Pill></td>
                      <td className="num">{fmtMoney(o.fulfillment, 2)}</td>
                      <td className="num">{fmtMoney(o.processing, 2)}</td>
                      <td className="num">{fmtMoney(o.refundsAndChargebacks, 2)}</td>
                      <td className="num">{fmtMoney(o.buffer, 2)}</td>
                      <td className="num text-good">+{fmtMoney(o.upsellContribution, 2)}</td>
                      <td className="num font-medium">{fmtMoney(o.contributionBeforeAds, 2)} <span className="text-mute text-xs">({fmtPct(o.contributionBeforeAdsPct)})</span></td>
                      <td className="num font-medium text-gold-soft">{fmtMoney(o.allowableCac, 2)}</td>
                    </tr>
                  ))}
                  {ue.offers.length === 0 && <tr><td colSpan={12} className="text-mute text-center py-6">Add a SKU with a landed cost and at least one offer below.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-dim">
              <span>Target net margin</span>
              <input type="range" min={0} max={0.4} step={0.01} value={targetMargin} onChange={(e) => setTargetMargin(Number(e.target.value))} />
              <span className="tabular-nums">{fmtPct(targetMargin)}</span>
              <span className="text-mute">— allowable NCPA = contribution before ads − price × this</span>
            </div>
          </Card>

          <div className="grid xl:grid-cols-2 gap-4">
            <Card title="SKUs and landed cost" hint="Landed = product + inbound shipping + duties + inspection, per unit." actions={<button className="btn btn-ghost" onClick={() => setSkus([...skus, { id: uid(), tenantId: "", productId: p.products[0]?.id ?? "", sku: "", variantTitle: "", shopifyVariantId: null, landedCost: 0, unitsPerPack: 1 }])}><Plus size={14} /> SKU</button>}>
              <table className="table">
                <thead><tr><th>SKU</th><th>Variant</th><th className="num">Landed cost</th><th /></tr></thead>
                <tbody>
                  {skus.map((s, i) => (
                    <tr key={s.id}>
                      <td><input className="input" value={s.sku} placeholder="NR-60" onChange={(e) => setSkus(skus.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} /></td>
                      <td><input className="input" value={s.variantTitle} placeholder="Night Reset · 60 ct" onChange={(e) => setSkus(skus.map((x, j) => (j === i ? { ...x, variantTitle: e.target.value } : x)))} /></td>
                      <td className="num"><input className="input text-right" type="number" step="0.01" value={s.landedCost} onChange={(e) => setSkus(skus.map((x, j) => (j === i ? { ...x, landedCost: n(e.target.value) } : x)))} /></td>
                      <td><button className="text-mute hover:text-bad" onClick={() => setSkus(skus.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Offers" hint="Price and how many units ship. The default offer drives the cash-flow view.">
              <table className="table">
                <thead><tr><th>Name</th><th className="num">Price</th><th>SKU</th><th className="num">Units</th><th>Default</th><th /></tr></thead>
                <tbody>
                  {offers.map((o, i) => (
                    <tr key={o.id}>
                      <td><input className="input" value={o.name} placeholder="Buy 2 Get 2" onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                      <td className="num w-24"><input className="input text-right" type="number" value={o.price} onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, price: n(e.target.value) } : x)))} /></td>
                      <td className="w-32"><select className="input" value={o.skuId} onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, skuId: e.target.value } : x)))}>{skus.map((s) => <option key={s.id} value={s.id}>{s.sku || "(unnamed)"}</option>)}</select></td>
                      <td className="num w-20"><input className="input text-right" type="number" value={o.unitsShipped} onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, unitsShipped: n(e.target.value) } : x)))} /></td>
                      <td><input type="radio" name="default-offer" checked={o.isDefault} onChange={() => setOffers(offers.map((x, j) => ({ ...x, isDefault: j === i })))} /></td>
                      <td><button className="text-mute hover:text-bad" onClick={() => setOffers(offers.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-ghost mt-3" onClick={() => setOffers([...offers, { id: uid(), tenantId: "", name: "", price: 0, skuId: skus[0]?.id ?? "", unitsShipped: 1, isDefault: offers.length === 0 }])}><Plus size={14} /> Offer</button>
            </Card>

            <Card title="Per-order costs" hint="Defaults are typical for a US supplement brand on a 3PL. Change them to yours.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Outbound shipping / order"><input className="input" type="number" step="0.01" value={costs.outboundShippingPerOrder} onChange={(e) => setCosts({ ...costs, outboundShippingPerOrder: n(e.target.value) })} /></Field>
                <Field label="Pick & pack / order"><input className="input" type="number" step="0.01" value={costs.fulfillmentPerOrder} onChange={(e) => setCosts({ ...costs, fulfillmentPerOrder: n(e.target.value) })} /></Field>
                <Field label="Packaging / unit"><input className="input" type="number" step="0.01" value={costs.fulfillmentPerUnit} onChange={(e) => setCosts({ ...costs, fulfillmentPerUnit: n(e.target.value) })} /></Field>
                <Field label="Processor rate %"><input className="input" type="number" step="0.1" value={pct(costs.processingRate)} onChange={(e) => setCosts({ ...costs, processingRate: n(e.target.value) / 100 })} /></Field>
                <Field label="Processor fixed fee"><input className="input" type="number" step="0.01" value={costs.processingFixed} onChange={(e) => setCosts({ ...costs, processingFixed: n(e.target.value) })} /></Field>
                <Field label="Slippage buffer %" hint="Course: 7–10%"><input className="input" type="number" step="0.5" value={pct(costs.bufferRate)} onChange={(e) => setCosts({ ...costs, bufferRate: n(e.target.value) / 100 })} /></Field>
                <Field label="Refund rate %"><input className="input" type="number" step="0.1" value={pct(costs.refundRate)} onChange={(e) => setCosts({ ...costs, refundRate: n(e.target.value) / 100 })} /></Field>
                <Field label="Chargeback rate %" hint="Flagged above 0.5%"><input className="input" type="number" step="0.05" value={pct(costs.chargebackRate)} onChange={(e) => setCosts({ ...costs, chargebackRate: n(e.target.value) / 100 })} /></Field>
                <Field label="Margin rule %" hint="Gross margin threshold"><input className="input" type="number" step="1" value={pct(costs.targetMarginRule)} onChange={(e) => setCosts({ ...costs, targetMarginRule: n(e.target.value) / 100 })} /></Field>
              </div>
            </Card>

            <div className="space-y-4">
              <Card title="Post-purchase upsells" hint="Expected contribution per order = take rate × (price − COGS)." actions={<button className="btn btn-ghost" onClick={() => setUpsells([...upsells, { id: uid(), tenantId: "", name: "", price: 0, cogs: 0, takeRate: 0.2 }])}><Plus size={14} /> Upsell</button>}>
                <table className="table">
                  <thead><tr><th>Name</th><th className="num">Price</th><th className="num">COGS</th><th className="num">Take %</th><th /></tr></thead>
                  <tbody>
                    {upsells.map((u, i) => (
                      <tr key={u.id}>
                        <td><input className="input" value={u.name} onChange={(e) => setUpsells(upsells.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                        <td className="num"><input className="input text-right" type="number" value={u.price} onChange={(e) => setUpsells(upsells.map((x, j) => (j === i ? { ...x, price: n(e.target.value) } : x)))} /></td>
                        <td className="num"><input className="input text-right" type="number" step="0.01" value={u.cogs} onChange={(e) => setUpsells(upsells.map((x, j) => (j === i ? { ...x, cogs: n(e.target.value) } : x)))} /></td>
                        <td className="num"><input className="input text-right" type="number" value={pct(u.takeRate)} onChange={(e) => setUpsells(upsells.map((x, j) => (j === i ? { ...x, takeRate: n(e.target.value) / 100 } : x)))} /></td>
                        <td><button className="text-mute hover:text-bad" onClick={() => setUpsells(upsells.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                    {upsells.length === 0 && <tr><td colSpan={5} className="text-mute text-center py-4">No upsells yet. A post-purchase upsell is the cheapest AOV you will ever buy.</td></tr>}
                  </tbody>
                </table>
              </Card>
              <Card title="Monthly opex" hint={`Total ${fmtMoney(ue.opexMonthly)} / month. Course target: at or under 7% of revenue.`} actions={<button className="btn btn-ghost" onClick={() => setOpex([...opex, { id: uid(), tenantId: "", name: "", monthly: 0 }])}><Plus size={14} /> Line</button>}>
                <table className="table">
                  <tbody>
                    {opex.map((l, i) => (
                      <tr key={l.id}>
                        <td><input className="input" value={l.name} placeholder="Software" onChange={(e) => setOpex(opex.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                        <td className="num w-36"><input className="input text-right" type="number" value={l.monthly} onChange={(e) => setOpex(opex.map((x, j) => (j === i ? { ...x, monthly: n(e.target.value) } : x)))} /></td>
                        <td className="w-8"><button className="text-mute hover:text-bad" onClick={() => setOpex(opex.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        </>
      )}

      {tab === "cash" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Assumptions" hint="Six months forward from the default offer's economics.">
            <div className="space-y-3">
              <Field label="Cash in the bank today"><input className="input" type="number" value={cash.startingCash} onChange={(e) => setCash({ ...cash, startingCash: n(e.target.value) })} /></Field>
              <Field label="Revenue next month" hint="Pre-filled from the last 30 days when connected"><input className="input" type="number" value={cash.revenue} onChange={(e) => setCash({ ...cash, revenue: n(e.target.value) })} /></Field>
              <Field label="Ad spend next month"><input className="input" type="number" value={cash.spend} onChange={(e) => setCash({ ...cash, spend: n(e.target.value) })} /></Field>
              <Field label="Monthly growth %"><input className="input" type="number" value={pct(cash.growth)} onChange={(e) => setCash({ ...cash, growth: n(e.target.value) / 100 })} /></Field>
              <Field label="Inventory purchase next month" hint="Deposit or full PO leaving the account"><input className="input" type="number" value={cash.inventoryPurchase} onChange={(e) => setCash({ ...cash, inventoryPurchase: n(e.target.value) })} /></Field>
            </div>
          </Card>
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Avg monthly net" value={fmtMoney(avgNet)} tone={avgNet >= 0 ? "good" : "bad"} />
              <Stat label="Runway" value={runway == null ? "Cash-positive" : `${runway.toFixed(1)} mo`} tone={runway == null ? "good" : runway < 3 ? "bad" : "warn"} formula="cash ÷ average monthly burn" />
              <Stat label="Cash in 6 months" value={fmtMoney(cashRows[cashRows.length - 1]?.cashEnd)} tone={(cashRows[cashRows.length - 1]?.cashEnd ?? 0) >= 0 ? "good" : "bad"} />
            </div>
            <Card title="Monthly cash view">
              <CashChart data={cashRows} />
              <div className="overflow-x-auto mt-3">
                <table className="table">
                  <thead><tr><th>Month</th><th className="num">Revenue</th><th className="num">COGS</th><th className="num">Fulfilment</th><th className="num">Processing</th><th className="num">Refunds</th><th className="num">Ad spend</th><th className="num">Opex</th><th className="num">Inventory</th><th className="num">Net</th><th className="num">Cash end</th></tr></thead>
                  <tbody>
                    {cashRows.map((r) => (
                      <tr key={r.month}>
                        <td>{r.month}</td><td className="num">{fmtMoney(r.revenue)}</td><td className="num">{fmtMoney(r.cogs)}</td><td className="num">{fmtMoney(r.fulfillment)}</td><td className="num">{fmtMoney(r.processing)}</td><td className="num">{fmtMoney(r.refunds)}</td><td className="num">{fmtMoney(r.adSpend)}</td><td className="num">{fmtMoney(r.opex)}</td><td className="num">{fmtMoney(r.inventoryPurchases)}</td><td className={`num font-medium ${r.net >= 0 ? "text-good" : "text-bad"}`}>{fmtMoney(r.net)}</td><td className={`num ${r.cashEnd >= 0 ? "" : "text-bad"}`}>{fmtMoney(r.cashEnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
