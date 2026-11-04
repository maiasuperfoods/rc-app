"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Field, Pill, fmtMoney, fmtPct } from "@/components/ui";
import type { BrandBook, CostInputs, IntegrationStatus, Offer, Sku, Tenant } from "@/lib/types";
import { createBrand, saveBrandBook, saveCostInputs, saveOffers, saveSkus, updateTenant } from "@/app/actions";
import { computeUnitEconomics } from "@/lib/calc/unit-economics";
import { Check } from "lucide-react";

const STEPS = ["Your brand", "Connect", "Products & costs", "Offers", "Positioning", "Done"];
const STAGES: { v: Tenant["stage"]; label: string; hint: string }[] = [
  { v: "grind", label: "Grind", hint: "Pre-revenue to ~$20k/mo. Looking for the first winning ad." },
  { v: "validation", label: "Validation", hint: "$20k–$100k/mo. Proving the offer pays for itself." },
  { v: "acceleration", label: "Acceleration", hint: "$100k–$500k/mo. Scaling spend inside allowable NCPA." },
  { v: "expansion", label: "Expansion", hint: "$500k+/mo. New avatars, angles and products." },
];
const uid = () => `tmp-${Math.random().toString(36).slice(2, 9)}`;

export function Wizard({ tenant, integrations, skus: s0, offers: o0, costs: c0, book: b0, demo }: { tenant: Tenant | null; integrations: IntegrationStatus[]; skus: Sku[]; offers: Offer[]; costs: CostInputs | null; book: BrandBook | null; demo: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(tenant ? 1 : 0);
  const [pending, start] = useTransition();
  const [brand, setBrand] = useState({ name: tenant?.name ?? "", domain: tenant?.domain ?? "", stage: tenant?.stage ?? ("validation" as Tenant["stage"]), revenue: "", spend: "" });
  const [skus, setSkus] = useState<Sku[]>(s0.length ? s0 : [{ id: uid(), tenantId: "", productId: "", sku: "", variantTitle: "", shopifyVariantId: null, landedCost: 0, unitsPerPack: 1 }]);
  const [costs, setCosts] = useState<CostInputs>(c0 ?? { tenantId: "", outboundShippingPerOrder: 5.2, fulfillmentPerOrder: 2.1, fulfillmentPerUnit: 0.35, processingRate: 0.029, processingFixed: 0.3, bufferRate: 0.07, refundRate: 0.04, chargebackRate: 0.004, targetMarginRule: 0.85 });
  const [offers, setOffers] = useState<Offer[]>(o0.length ? o0 : [{ id: uid(), tenantId: "", name: "Buy 2 Get 2", price: 89, skuId: skus[0]?.id ?? "", unitsShipped: 4, isDefault: true }]);
  const [mechanism, setMechanism] = useState(b0?.mechanism ?? "");
  const [avatar, setAvatar] = useState({ name: b0?.avatars[0]?.name ?? "", summary: b0?.avatars[0]?.summary ?? "", positioning: b0?.avatars[0]?.positioning ?? "" });
  const n = (v: string) => (v === "" ? 0 : Number(v));

  const suggestedStage = useMemo<Tenant["stage"] | null>(() => {
    const r = Number(brand.revenue);
    if (!r) return null;
    return r < 20000 ? "grind" : r < 100000 ? "validation" : r < 500000 ? "acceleration" : "expansion";
  }, [brand.revenue]);

  const ue = useMemo(() => computeUnitEconomics({ offers: offers.map((o) => ({ ...o, skuId: o.skuId || skus[0]?.id })), skus, costs, upsells: [], opex: [] }), [offers, skus, costs]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  const saveBrand = () =>
    start(async () => {
      if (!tenant) await createBrand({ name: brand.name, domain: brand.domain, stage: brand.stage });
      else await updateTenant({ name: brand.name, domain: brand.domain || null, stage: brand.stage });
      router.refresh();
      next();
    });
  const saveCosts = () => start(async () => { await saveSkus(skus); await saveCostInputs(costs); next(); });
  const saveOffersStep = () => start(async () => { await saveOffers(offers.map((o) => ({ ...o, skuId: o.skuId || skus[0]?.id }))); next(); });
  const savePositioning = () =>
    start(async () => {
      const base: BrandBook = b0 ?? { tenantId: "", version: 0, updatedAt: "", category: "supplement", mechanism: "", avatars: [], angles: [], proof: [], objections: [], complianceRails: ["No disease claims", "No 'cure', 'treat' or 'prevent'", "Before/after only with written consent"], adNamingConvention: "[Angle] | [Stage] | [Hook] | [Format] | [Product] | [Creator]" };
      const avatars = avatar.name ? [{ id: uid(), name: avatar.name, age: "", summary: avatar.summary, painPoints: [], desires: [], objections: [], positioning: avatar.positioning }, ...base.avatars.slice(1)] : base.avatars;
      await saveBrandBook({ ...base, mechanism, avatars });
      next();
    });
  const finish = () => start(async () => { await updateTenant({ onboardingComplete: true }); router.push("/"); router.refresh(); });

  return (
    <div>
      <ol className="flex items-center gap-2 mb-8 text-xs flex-wrap">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i === step ? "text-gold-soft" : i < step ? "text-dim" : "text-mute"}`}>
            <span className={`h-5 w-5 rounded-full grid place-items-center text-[10px] border ${i < step ? "bg-gold text-bg border-gold" : i === step ? "border-gold" : "border-line-strong"}`}>{i < step ? <Check size={11} /> : i + 1}</span>
            {s}
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-line" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card title="Tell us about your brand" hint="Two minutes. You can change all of this later.">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Brand name"><input className="input" value={brand.name} placeholder="Glowbright Labs" onChange={(e) => setBrand({ ...brand, name: e.target.value })} /></Field>
            <Field label="Website"><input className="input" value={brand.domain} placeholder="glowbrightlabs.com" onChange={(e) => setBrand({ ...brand, domain: e.target.value })} /></Field>
            <Field label="Monthly revenue (rough)" hint="Replaced by Shopify once connected"><input className="input" type="number" value={brand.revenue} placeholder="120000" onChange={(e) => setBrand({ ...brand, revenue: e.target.value, stage: suggestedStage ?? brand.stage })} /></Field>
            <Field label="Monthly ad spend (rough)"><input className="input" type="number" value={brand.spend} placeholder="45000" onChange={(e) => setBrand({ ...brand, spend: e.target.value })} /></Field>
          </div>
          <div className="label mt-6 mb-2">Stage {suggestedStage && <span className="normal-case tracking-normal text-gold-soft">· suggested: {STAGES.find((s) => s.v === suggestedStage)?.label}</span>}</div>
          <div className="grid md:grid-cols-2 gap-2">
            {STAGES.map((s) => (
              <button key={s.v} onClick={() => setBrand({ ...brand, stage: s.v })} className={`text-left rounded-lg border p-3 transition ${brand.stage === s.v ? "border-gold bg-gold-dim" : "border-line hover:border-line-strong"}`}>
                <div className="text-sm text-ink">{s.label}</div>
                <div className="text-xs text-mute">{s.hint}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-6"><button className="btn btn-primary" disabled={!brand.name || pending} onClick={saveBrand}>Continue</button></div>
        </Card>
      )}

      {step === 1 && (
        <Card title="Connect your store and ad account" hint="Each connection unlocks a tool. You can skip and come back; Unit Economics works without any.">
          <ul className="space-y-2">
            {(["shopify", "meta", "triple_whale"] as const).map((p) => {
              const st = integrations.find((i) => i.provider === p);
              const name = { shopify: "Shopify", meta: "Meta Ads", triple_whale: "Triple Whale" }[p];
              return (
                <li key={p} className="flex items-center justify-between card-elev px-4 py-3">
                  <div><div className="text-sm text-ink">{name}</div><div className="text-xs text-mute">{p === "shopify" ? "Orders, products and stock" : p === "meta" ? "Ad performance for the creative dashboard" : "Blended ROAS and NCPA"}</div></div>
                  {st?.connected ? <Pill tone="good">Connected</Pill> : demo ? <Pill tone="mute">Demo</Pill> : p === "triple_whale" ? <a className="btn btn-ghost" href="/integrations">Add key</a> : <a className="btn btn-primary" href={`/api/integrations/${p}/start?return=/onboarding`}>Connect</a>}
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between mt-6"><button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button><button className="btn btn-primary" onClick={next}>Continue</button></div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Products and what they cost you" hint="Landed cost = product + inbound shipping + duties + inspection, per unit. If Shopify is connected your products are already here; confirm the costs.">
          <table className="table">
            <thead><tr><th>SKU code</th><th>Name</th><th className="num">Landed cost / unit</th></tr></thead>
            <tbody>
              {skus.map((s, i) => (
                <tr key={s.id}>
                  <td className="w-32"><input className="input" value={s.sku} placeholder="NR-60" onChange={(e) => setSkus(skus.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} /></td>
                  <td><input className="input" value={s.variantTitle} placeholder="Night Reset · 60 ct" onChange={(e) => setSkus(skus.map((x, j) => (j === i ? { ...x, variantTitle: e.target.value } : x)))} /></td>
                  <td className="num w-40"><input className="input text-right" type="number" step="0.01" value={s.landedCost || ""} placeholder="3.40" onChange={(e) => setSkus(skus.map((x, j) => (j === i ? { ...x, landedCost: n(e.target.value) } : x)))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-ghost mt-2" onClick={() => setSkus([...skus, { id: uid(), tenantId: "", productId: "", sku: "", variantTitle: "", shopifyVariantId: null, landedCost: 0, unitsPerPack: 1 }])}>+ Another SKU</button>
          <div className="grid md:grid-cols-3 gap-3 mt-6">
            <Field label="Shipping per order"><input className="input" type="number" step="0.01" value={costs.outboundShippingPerOrder} onChange={(e) => setCosts({ ...costs, outboundShippingPerOrder: n(e.target.value) })} /></Field>
            <Field label="Pick & pack per order"><input className="input" type="number" step="0.01" value={costs.fulfillmentPerOrder} onChange={(e) => setCosts({ ...costs, fulfillmentPerOrder: n(e.target.value) })} /></Field>
            <Field label="Refund rate %"><input className="input" type="number" step="0.1" value={Math.round(costs.refundRate * 1000) / 10} onChange={(e) => setCosts({ ...costs, refundRate: n(e.target.value) / 100 })} /></Field>
          </div>
          <div className="flex justify-between mt-6"><button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button><button className="btn btn-primary" disabled={pending || !skus.some((s) => s.landedCost > 0)} onClick={saveCosts}>Continue</button></div>
        </Card>
      )}

      {step === 3 && (
        <Card title="Your offers" hint="What a customer can buy and how many units ship. The 85% rule is checked live.">
          <table className="table">
            <thead><tr><th>Offer</th><th className="num">Price</th><th className="num">Units shipped</th><th className="num">Gross margin</th></tr></thead>
            <tbody>
              {offers.map((o, i) => {
                const e = ue.offers.find((x) => x.offerId === o.id);
                return (
                  <tr key={o.id}>
                    <td><input className="input" value={o.name} placeholder="Buy 2 Get 2" onChange={(ev) => setOffers(offers.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))} /></td>
                    <td className="num w-32"><input className="input text-right" type="number" value={o.price} onChange={(ev) => setOffers(offers.map((x, j) => (j === i ? { ...x, price: n(ev.target.value) } : x)))} /></td>
                    <td className="num w-32"><input className="input text-right" type="number" value={o.unitsShipped} onChange={(ev) => setOffers(offers.map((x, j) => (j === i ? { ...x, unitsShipped: n(ev.target.value) } : x)))} /></td>
                    <td className="num">{e ? <Pill tone={e.passesRule ? "good" : "bad"}>{fmtPct(e.grossMarginPct, 1)}</Pill> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="btn btn-ghost mt-2" onClick={() => setOffers([...offers, { id: uid(), tenantId: "", name: "", price: 0, skuId: skus[0]?.id ?? "", unitsShipped: 1, isDefault: false }])}>+ Another offer</button>
          {ue.blended && (
            <div className="card-elev p-4 mt-5 text-sm">
              <div className="text-dim">With these inputs you can spend up to <span className="text-gold-soft font-medium">{fmtMoney(ue.blended.allowableCac, 2)}</span> to acquire a customer and still keep a 20% net margin. Break-even is {fmtMoney(ue.blended.breakEvenCac, 2)}.</div>
            </div>
          )}
          <div className="flex justify-between mt-6"><button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button><button className="btn btn-primary" disabled={pending} onClick={saveOffersStep}>Continue</button></div>
        </Card>
      )}

      {step === 4 && (
        <Card title="Positioning, the short version" hint="Enough to start briefing creative. The full Brand Book has avatars, angles, proof and compliance rails.">
          <Field label="Unique mechanism — why your product works when others didn't (6th-grade language)">
            <textarea className="input min-h-28" value={mechanism} placeholder="Example (invented brand): Night Reset uses a slow-release blend of magnesium, glycine and tart cherry so your body drops into deep sleep on its own, instead of being knocked out by melatonin and waking up groggy." onChange={(e) => setMechanism(e.target.value)} />
          </Field>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Field label="Your main avatar, nicknamed"><input className="input" value={avatar.name} placeholder="Wired Dana" onChange={(e) => setAvatar({ ...avatar, name: e.target.value })} /></Field>
            <Field label="Positioning — We are the X for Y who want Z without W"><input className="input" value={avatar.positioning} onChange={(e) => setAvatar({ ...avatar, positioning: e.target.value })} /></Field>
            <div className="md:col-span-2"><Field label="Who they are, in a sentence or two"><textarea className="input min-h-20" value={avatar.summary} onChange={(e) => setAvatar({ ...avatar, summary: e.target.value })} /></Field></div>
          </div>
          <div className="flex justify-between mt-6"><button className="btn btn-ghost" onClick={() => setStep(3)}>Back</button><button className="btn btn-primary" disabled={pending} onClick={savePositioning}>Continue</button></div>
        </Card>
      )}

      {step === 5 && (
        <Card title="You're set">
          <p className="text-sm text-dim">Unit Economics is live now. If you connected Shopify and Meta, your first dashboard fills in within 24 hours as the history loads; you don&apos;t need to wait on this page.</p>
          <ul className="text-sm text-dim mt-4 space-y-1 list-disc pl-5">
            <li>Every Monday: one-page Weekly Review with commentary.</li>
            <li>Name every ad with the convention in your Brand Book so the creative dashboard can read it.</li>
            <li>Add supplier lead times on the Inventory page before your next reorder.</li>
          </ul>
          <div className="flex justify-end mt-6"><button className="btn btn-primary" disabled={pending} onClick={finish}>Go to my dashboard</button></div>
        </Card>
      )}
    </div>
  );
}
