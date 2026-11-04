"use client";
import { useState, useTransition } from "react";
import { Card, fmtMoney } from "@/components/ui";
import type { Sku, SpendPlan, Supplier } from "@/lib/types";
import { saveSpendPlan, saveSuppliers } from "@/app/actions";
import { Plus, Trash2 } from "lucide-react";

export function InventoryInputs({ suppliers: s0, spendPlan: p0, skus, currentMonthlySpend }: { suppliers: Supplier[]; spendPlan: SpendPlan; skus: Sku[]; currentMonthlySpend: number }) {
  const [suppliers, setSuppliers] = useState(s0);
  const [plan, setPlan] = useState(p0.months.length ? p0.months : nextMonths(3).map((month) => ({ month, spend: Math.round(currentMonthlySpend) })));
  const [pending, start] = useTransition();
  const n = (v: string) => (v === "" ? 0 : Number(v));
  const save = () => start(async () => { await Promise.all([saveSuppliers(suppliers), saveSpendPlan(plan)]); });
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Suppliers" hint="Lead time and MOQ per SKU drive the reorder date and PO size." className="lg:col-span-2" actions={<button className="btn btn-ghost" onClick={() => setSuppliers([...suppliers, { id: `tmp-${Date.now()}`, tenantId: "", skuId: skus[0]?.id ?? "", name: "", leadTimeDays: 30, moq: 1000, paymentTerms: "Net 30" }])}><Plus size={14} /> Supplier</button>}>
        <table className="table">
          <thead><tr><th>SKU</th><th>Supplier</th><th className="num">Lead time (days)</th><th className="num">MOQ</th><th>Terms</th><th /></tr></thead>
          <tbody>
            {suppliers.map((s, i) => (
              <tr key={s.id}>
                <td className="w-44"><select className="input" value={s.skuId} onChange={(e) => setSuppliers(suppliers.map((x, j) => (j === i ? { ...x, skuId: e.target.value } : x)))}>{skus.map((k) => <option key={k.id} value={k.id}>{k.sku}</option>)}</select></td>
                <td><input className="input" value={s.name} placeholder="Northstar Nutraceuticals" onChange={(e) => setSuppliers(suppliers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                <td className="num w-28"><input className="input text-right" type="number" value={s.leadTimeDays} onChange={(e) => setSuppliers(suppliers.map((x, j) => (j === i ? { ...x, leadTimeDays: n(e.target.value) } : x)))} /></td>
                <td className="num w-28"><input className="input text-right" type="number" value={s.moq} onChange={(e) => setSuppliers(suppliers.map((x, j) => (j === i ? { ...x, moq: n(e.target.value) } : x)))} /></td>
                <td className="w-40"><input className="input" value={s.paymentTerms} onChange={(e) => setSuppliers(suppliers.map((x, j) => (j === i ? { ...x, paymentTerms: e.target.value } : x)))} /></td>
                <td><button className="text-mute hover:text-bad" onClick={() => setSuppliers(suppliers.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Planned ad spend, next 90 days" hint={`Current run-rate ${fmtMoney(currentMonthlySpend)} / month. More spend → more demand.`} actions={<button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button>}>
        <div className="space-y-2">
          {plan.map((m, i) => (
            <div key={m.month} className="flex items-center gap-3">
              <span className="text-sm text-dim w-20">{m.month}</span>
              <input className="input text-right" type="number" value={m.spend} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, spend: n(e.target.value) } : x)))} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function nextMonths(k: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 1; i <= k; i++) out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  return out;
}
