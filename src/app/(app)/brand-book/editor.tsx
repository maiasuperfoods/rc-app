"use client";
import { useState, useTransition } from "react";
import { Card, Field, Pill } from "@/components/ui";
import type { AngleFamily, Avatar, BrandBook, Objection, Product, ProofItem } from "@/lib/types";
import { saveBrandBook } from "@/app/actions";
import { brandBookToMarkdown, readingGrade } from "@/lib/brand-book-markdown";
import { parseConvention } from "@/lib/calc/creative";
import { Plus, Trash2, Download } from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 9);
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

const COMPLIANCE_PRESETS: Record<BrandBook["category"], string[]> = {
  supplement: ["No disease claims (name no condition)", "Never 'clinically proven' about the product; only about an ingredient's published study", "No 'cure', 'treat', 'prevent', 'diagnose'", "Before/after only with written consent", "FDA disclaimer on every landing page"],
  device: ["No medical claims unless cleared", "Results claims must cite the study", "Safety disclaimers on every page"],
  skincare: ["No 'anti-aging' or structural claims", "No medical claims (acne, eczema, rosacea) without OTC status", "Before/after only with written consent"],
  apparel: ["No performance claims without testing", "Material claims must match the label"],
  other: ["No claims you cannot substantiate", "Before/after only with written consent"],
};

export function BrandBookEditor({ book: initial, products, tenantName }: { book: BrandBook; products: Product[]; tenantName: string }) {
  const [book, setBook] = useState<BrandBook>(initial);
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"core" | "avatars" | "angles" | "proof" | "rails">("core");
  const [sample, setSample] = useState("RMD | PA | WakeAt3 | UGC | NightReset | JO");
  const grade = readingGrade(book.mechanism);
  const fields = parseConvention(book.adNamingConvention);
  const sampleOk = sample.split("|").length >= fields.length && fields.length > 0;

  const save = () =>
    start(async () => {
      const v = await saveBrandBook(book);
      setBook({ ...book, version: v, updatedAt: new Date().toISOString() });
    });

  const download = () => {
    const blob = new Blob([brandBookToMarkdown(book, tenantName)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tenantName.toLowerCase().replace(/\s+/g, "-")}-brand-book.md`;
    a.click();
  };

  const setAvatar = (i: number, patch: Partial<Avatar>) => setBook({ ...book, avatars: book.avatars.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const setAngle = (i: number, patch: Partial<AngleFamily>) => setBook({ ...book, angles: book.angles.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  const tabs: [typeof tab, string][] = [["core", "Mechanism"], ["avatars", `Avatars (${book.avatars.length})`], ["angles", `Angles (${book.angles.length})`], ["proof", "Proof & objections"], ["rails", "Compliance & naming"]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} className={`btn ${tab === k ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(k)}>{l}</button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-mute">v{book.version} · updated {new Date(book.updatedAt).toLocaleDateString()}</span>
        <button className="btn btn-ghost" onClick={download}><Download size={14} /> Markdown</button>
        <button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save new version"}</button>
      </div>

      {tab === "core" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Unique mechanism" hint="One paragraph a 6th grader could repeat. Why your product works when the others didn't." className="lg:col-span-2">
            <textarea className="input min-h-40" value={book.mechanism} placeholder="Example (invented brand): Night Reset uses a slow-release blend of magnesium, glycine and tart cherry so your body drops into deep sleep on its own, instead of being knocked out by melatonin and waking up groggy." onChange={(e) => setBook({ ...book, mechanism: e.target.value })} />
            <div className="mt-2 text-xs flex items-center gap-2">
              <span className="text-mute">Kindergarten-pitch check:</span>
              {grade == null ? <span className="text-mute">write a few sentences</span> : <Pill tone={grade <= 7 ? "good" : grade <= 9 ? "warn" : "bad"}>grade {grade.toFixed(1)} reading level</Pill>}
            </div>
          </Card>
          <Card title="Category" hint="Sets the default compliance rails.">
            <select className="input" value={book.category} onChange={(e) => { const category = e.target.value as BrandBook["category"]; setBook({ ...book, category, complianceRails: book.complianceRails.length ? book.complianceRails : COMPLIANCE_PRESETS[category] }); }}>
              {Object.keys(COMPLIANCE_PRESETS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="label mt-5 mb-2">Products</div>
            <ul className="text-sm text-dim space-y-1">
              {products.map((p) => <li key={p.id}>{p.title}</li>)}
              {products.length === 0 && <li className="text-mute">Products appear here after you connect Shopify.</li>}
            </ul>
          </Card>
        </div>
      )}

      {tab === "avatars" && (
        <div className="space-y-4">
          {book.avatars.map((a, i) => (
            <Card key={a.id} title={a.name || `Avatar ${i + 1}`} actions={<button className="text-mute hover:text-bad" onClick={() => setBook({ ...book, avatars: book.avatars.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}>
              <div className="grid md:grid-cols-3 gap-3">
                <Field label="Name" hint="Give them a nickname you'll use in briefs"><input className="input" value={a.name} placeholder="Wired Dana" onChange={(e) => setAvatar(i, { name: e.target.value })} /></Field>
                <Field label="Age range"><input className="input" value={a.age} placeholder="38–52" onChange={(e) => setAvatar(i, { age: e.target.value })} /></Field>
                <Field label="Positioning" hint="We are the X for Y who want Z without W"><input className="input" value={a.positioning} onChange={(e) => setAvatar(i, { positioning: e.target.value })} /></Field>
                <div className="md:col-span-3"><Field label="Who they are, in one paragraph"><textarea className="input min-h-20" value={a.summary} onChange={(e) => setAvatar(i, { summary: e.target.value })} /></Field></div>
                <Field label="Pain points (one per line)"><textarea className="input min-h-24" value={a.painPoints.join("\n")} onChange={(e) => setAvatar(i, { painPoints: lines(e.target.value) })} /></Field>
                <Field label="Desires (one per line)"><textarea className="input min-h-24" value={a.desires.join("\n")} onChange={(e) => setAvatar(i, { desires: lines(e.target.value) })} /></Field>
                <Field label="Objections (one per line)"><textarea className="input min-h-24" value={a.objections.join("\n")} onChange={(e) => setAvatar(i, { objections: lines(e.target.value) })} /></Field>
              </div>
            </Card>
          ))}
          <button className="btn btn-secondary" onClick={() => setBook({ ...book, avatars: [...book.avatars, { id: uid(), name: "", age: "", summary: "", painPoints: [], desires: [], objections: [], positioning: "" }] })}><Plus size={14} /> Add avatar {book.avatars.length >= 5 && "(the course suggests 2–5)"}</button>
        </div>
      )}

      {tab === "angles" && (
        <div className="space-y-4">
          <Card title="Angle families" hint="An angle is the belief the ad has to install. Headlines are the proof it can be said in one line. Status updates from the creative dashboard.">
            <table className="table">
              <thead><tr><th>Angle</th><th>Avatar</th><th>Winning headlines (one per line)</th><th>Status</th><th /></tr></thead>
              <tbody>
                {book.angles.map((an, i) => (
                  <tr key={an.id}>
                    <td className="w-56"><input className="input" value={an.name} placeholder="It's not your shampoo, it's your water" onChange={(e) => setAngle(i, { name: e.target.value })} /></td>
                    <td className="w-40"><select className="input" value={an.avatarId ?? ""} onChange={(e) => setAngle(i, { avatarId: e.target.value || null })}><option value="">—</option>{book.avatars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></td>
                    <td><textarea className="input min-h-16" value={an.headlines.join("\n")} onChange={(e) => setAngle(i, { headlines: lines(e.target.value) })} /></td>
                    <td className="w-32"><select className="input" value={an.status} onChange={(e) => setAngle(i, { status: e.target.value as AngleFamily["status"] })}><option value="untested">untested</option><option value="testing">testing</option><option value="winner">winner</option><option value="retired">retired</option></select></td>
                    <td><button className="text-mute hover:text-bad" onClick={() => setBook({ ...book, angles: book.angles.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-ghost mt-3" onClick={() => setBook({ ...book, angles: [...book.angles, { id: uid(), name: "", avatarId: null, headlines: [], status: "untested" }] })}><Plus size={14} /> Angle</button>
          </Card>
        </div>
      )}

      {tab === "proof" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Proof inventory" hint="Reviews, studies, authority, before/afters. Generators only use what is here.">
            <table className="table">
              <thead><tr><th>Type</th><th>Label</th><th>Detail</th><th /></tr></thead>
              <tbody>
                {book.proof.map((p, i) => (
                  <tr key={p.id}>
                    <td className="w-32"><select className="input" value={p.type} onChange={(e) => setBook({ ...book, proof: book.proof.map((x, j) => (j === i ? { ...x, type: e.target.value as ProofItem["type"] } : x)) })}>{["reviews", "study", "authority", "before_after", "press", "other"].map((t) => <option key={t}>{t}</option>)}</select></td>
                    <td><input className="input" value={p.label} placeholder="4.8 stars, 2,100 reviews" onChange={(e) => setBook({ ...book, proof: book.proof.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></td>
                    <td><input className="input" value={p.detail} onChange={(e) => setBook({ ...book, proof: book.proof.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)) })} /></td>
                    <td><button className="text-mute hover:text-bad" onClick={() => setBook({ ...book, proof: book.proof.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-ghost mt-3" onClick={() => setBook({ ...book, proof: [...book.proof, { id: uid(), type: "reviews", label: "", detail: "" }] })}><Plus size={14} /> Proof</button>
          </Card>
          <Card title="Objections and answers" hint="Every objection gets one answer the whole team uses.">
            <table className="table">
              <thead><tr><th>Objection</th><th>Answer</th><th /></tr></thead>
              <tbody>
                {book.objections.map((o, i) => (
                  <tr key={o.id}>
                    <td><input className="input" value={o.objection} placeholder="Too expensive" onChange={(e) => setBook({ ...book, objections: book.objections.map((x, j) => (j === i ? { ...x, objection: e.target.value } : x)) })} /></td>
                    <td><input className="input" value={o.answer} placeholder="Cost-per-day framing" onChange={(e) => setBook({ ...book, objections: book.objections.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })} /></td>
                    <td><button className="text-mute hover:text-bad" onClick={() => setBook({ ...book, objections: book.objections.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-ghost mt-3" onClick={() => setBook({ ...book, objections: [...book.objections, { id: uid(), objection: "", answer: "" } as Objection] })}><Plus size={14} /> Objection</button>
          </Card>
        </div>
      )}

      {tab === "rails" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Compliance rails" hint="Non-negotiable. Generators refuse copy that breaks them." actions={<button className="btn btn-ghost" onClick={() => setBook({ ...book, complianceRails: COMPLIANCE_PRESETS[book.category] })}>Reset to {book.category} defaults</button>}>
            <textarea className="input min-h-48" value={book.complianceRails.join("\n")} onChange={(e) => setBook({ ...book, complianceRails: lines(e.target.value) })} />
            <p className="text-xs text-mute mt-2">One rule per line.</p>
          </Card>
          <Card title="Strategists" hint="The code at the end of every ad name → the name shown on the creative dashboard." actions={<button className="btn btn-ghost" onClick={() => setBook({ ...book, strategists: [...(book.strategists ?? []), { code: "", name: "" }] })}><Plus size={14} /> Strategist</button>}>
            <table className="table">
              <thead><tr><th>Code</th><th>Name</th><th /></tr></thead>
              <tbody>
                {(book.strategists ?? []).map((st, i) => (
                  <tr key={i}>
                    <td className="w-32"><input className="input font-mono" value={st.code} placeholder="JO" onChange={(e) => setBook({ ...book, strategists: book.strategists.map((x, j) => (j === i ? { ...x, code: e.target.value.trim().toUpperCase() } : x)) })} /></td>
                    <td><input className="input" value={st.name} placeholder="Jo Lindqvist" onChange={(e) => setBook({ ...book, strategists: book.strategists.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></td>
                    <td className="w-8"><button className="text-mute hover:text-bad" onClick={() => setBook({ ...book, strategists: book.strategists.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
                {(book.strategists ?? []).length === 0 && <tr><td colSpan={3} className="text-mute text-center py-4">No strategists yet. Ads without a known code sit under Unassigned.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Ad naming convention" hint="The creative dashboard parses every ad name with this pattern. SOP fields: angle, awareness, name, type, product, strategist.">
            <input className="input font-mono text-sm" value={book.adNamingConvention} onChange={(e) => setBook({ ...book, adNamingConvention: e.target.value })} />
            <div className="label mt-4 mb-1.5">Try a sample ad name</div>
            <input className="input font-mono text-sm" value={sample} onChange={(e) => setSample(e.target.value)} />
            <div className="mt-2 text-xs flex items-center gap-2 flex-wrap">
              {fields.length === 0 ? <Pill tone="bad">No recognised fields in the pattern</Pill> : sampleOk ? <Pill tone="good">Parses into {fields.length} fields</Pill> : <Pill tone="warn">Needs {fields.length} parts separated by |</Pill>}
              {sampleOk && fields.map((f, i) => <span key={f} className="pill pill-mute">{f}: {sample.split("|")[i]?.trim()}</span>)}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
