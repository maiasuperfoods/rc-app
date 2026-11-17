"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Check, ChevronDown, Copy, Download, FileText, Plus } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { AGREEMENT_LABEL, STAGE_LABEL, STAGE_TONE, referralStage, type Desk, type Partner, type PartnerTerms, type Payment, type ReferralRequest, type ReferralStage, type Tracking } from "@/lib/referrals-shared";
import * as A from "./actions";

type Res = { ok: true } | { ok: false; error: string };
function useAct() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Res>, then?: () => void) => start(async () => { const r = await fn(); if (r.ok) { setError(null); then?.(); } else setError(r.error); });
  return { pending, error, run, setError };
}
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const date = (s: string | null) => (s ? new Date(s.length === 10 ? s + "T12:00:00Z" : s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—");
const today = () => new Date().toISOString().slice(0, 10);
const Err = ({ e }: { e: string | null }) => (e ? <p className="text-sm text-bad">{e}</p> : null);
function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="label block mb-1.5">{label}</span>{children}</label>;
}
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="btn btn-ghost text-xs" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* text stays on screen */ } }}>{done ? <Check size={13} /> : <Copy size={13} />}{done ? "Copied" : label}</button>;
}

interface Row { r: ReferralRequest; partner: Partner | undefined; terms: PartnerTerms | undefined; t: Tracking | undefined; pays: Payment[]; stage: ReferralStage; due: number; paid: number }
export function useRows(desk: Desk): Row[] {
  return useMemo(() => {
    const partners = new Map(desk.partners.map((p) => [p.id, p]));
    const terms = new Map(desk.terms.map((t) => [t.partnerId, t]));
    const tracking = new Map(desk.tracking.map((t) => [t.requestId, t]));
    return desk.requests.map((r) => {
      const pays = desk.payments.filter((p) => p.requestId === r.id);
      const t = tracking.get(r.id);
      return { r, partner: partners.get(r.partnerId), terms: terms.get(r.partnerId), t, pays, stage: referralStage(r, t, pays), due: pays.filter((p) => p.status === "due").reduce((a, p) => a + p.amount, 0), paid: pays.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0) };
    });
  }, [desk]);
}

// ---------- Requests ----------

function messageFor(row: Row, link: string, code: string, note: string) {
  const first = row.r.requesterName.split(" ")[0] || "there";
  const lines = [`Hi ${first},`, "", `Here is your access to ${row.partner?.name ?? "the partner"}.`];
  if (link) lines.push(`Link: ${link}`);
  if (code) lines.push(`Code: ${code}`);
  if (note) lines.push("", note);
  lines.push("", "Please sign up with the link or code above so they know you came through Renaissance Commerce.");
  return lines.join("\n");
}

function Approve({ row }: { row: Row }) {
  const { pending, error, run } = useAct();
  const [mode, setMode] = useState<"idle" | "approve" | "decline">("idle");
  const [link, setLink] = useState(row.terms?.referralLink ?? "");
  const [code, setCode] = useState(row.terms?.referralCode ?? "");
  const [message, setMessage] = useState("");
  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-ink font-medium">{row.r.tenantName || "Unnamed brand"} <span className="text-mute font-normal">wants</span> {row.partner?.name ?? "a removed partner"}</div>
          <div className="text-xs text-mute mt-0.5">{row.r.requesterName} · <a className="hover:underline" href={`mailto:${row.r.requesterEmail}`}>{row.r.requesterEmail}</a> · asked {date(row.r.createdAt)}</div>
          {row.r.note && <p className="text-sm text-dim mt-2">“{row.r.note}”</p>}
        </div>
        {mode === "idle" && (
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={() => setMode("approve")}>Approve and send</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("decline")}>Decline</button>
          </div>
        )}
      </div>
      {mode === "approve" && (
        <div className="space-y-3 border-t border-line pt-3">
          {row.terms && !row.terms.referralLink && !row.terms.referralCode && <p className="text-xs text-warn">No link or code is saved for this partner yet. Get one from {row.terms.contactName ?? "the vendor"}, paste it here, and save it on the Partners tab so it fills in next time.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Referral link"><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></F>
            <F label="Code"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} /></F>
            <F label="Note to the student (optional)" wide><textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Who will contact them, what to mention, anything to prepare" /></F>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => A.approveRequest(row.r.id, { link, code, message }))}>{pending ? "Sending…" : "Send to student"}</button>
            <CopyBtn text={messageFor(row, link, code, message)} label="Copy as email" />
            <button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
          <p className="text-xs text-mute">The student sees this on their Partners page straight away. The app does not email them, so use “Copy as email” if you also want to send it.</p>
        </div>
      )}
      {mode === "decline" && (
        <div className="space-y-3 border-t border-line pt-3">
          <F label="Reason the student will see (optional)"><textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} /></F>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(() => A.declineRequest(row.r.id, message))}>Decline request</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </div>
      )}
      <Err e={error} />
    </div>
  );
}

function PaymentLine({ p }: { p: Payment }) {
  const { pending, error, run } = useAct();
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(today());
  const [reference, setReference] = useState("");
  return (
    <li className="py-2 border-t border-line first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="tabular-nums text-ink font-medium w-24">{money(p.amount)}</span>
        <span className="text-dim flex-1 min-w-32">{p.period ?? "One-time"}</span>
        {p.status === "paid" ? <span className="text-xs text-good">Paid {date(p.paidOn)}{p.reference ? ` · ${p.reference}` : ""}</span> : <span className={`text-xs ${p.dueOn && p.dueOn < today() ? "text-bad" : "text-warn"}`}>Due {date(p.dueOn)}</span>}
        {p.status === "due" ? <button type="button" className="btn btn-secondary text-xs" onClick={() => setOpen((o) => !o)}>Mark paid</button> : <button type="button" className="text-xs text-mute hover:text-ink underline" disabled={pending} onClick={() => run(() => A.markPaymentDue(p.id))}>Undo</button>}
        <button type="button" className="text-xs text-mute hover:text-bad underline" disabled={pending} onClick={() => { if (window.confirm("Remove this commission entry?")) run(() => A.deletePayment(p.id)); }}>Remove</button>
      </div>
      {open && p.status === "due" && (
        <div className="flex flex-wrap items-end gap-2 mt-2">
          <F label="Date received"><input type="date" className="input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></F>
          <F label="Reference"><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Wire, invoice or payout ID" /></F>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => A.markPaymentPaid(p.id, { paidOn, reference }), () => setOpen(false))}>Save</button>
        </div>
      )}
      <Err e={error} />
    </li>
  );
}

function AddPayment({ requestId }: { requestId: string }) {
  const { pending, error, run } = useAct();
  const [open, setOpen] = useState(false);
  const blank = { amount: "", period: "", dueOn: "", paid: false, paidOn: today(), reference: "" };
  const [v, setV] = useState(blank);
  if (!open) return <button type="button" className="btn btn-secondary text-xs" onClick={() => setOpen(true)}><Plus size={13} /> Add commission</button>;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <F label="Amount (USD)"><input className="input" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="250.00" /></F>
        <F label="Period (if recurring)"><input className="input" value={v.period} onChange={(e) => setV({ ...v, period: e.target.value })} placeholder="November 2026" /></F>
        <F label="Due date"><input type="date" className="input" value={v.dueOn} onChange={(e) => setV({ ...v, dueOn: e.target.value })} /></F>
      </div>
      <label className="flex items-center gap-2 text-sm text-dim"><input type="checkbox" checked={v.paid} onChange={(e) => setV({ ...v, paid: e.target.checked })} /> Already received</label>
      {v.paid && (
        <div className="grid gap-2 sm:grid-cols-3">
          <F label="Date received"><input type="date" className="input" value={v.paidOn} onChange={(e) => setV({ ...v, paidOn: e.target.value })} /></F>
          <F label="Reference"><input className="input" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></F>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => A.addPayment(requestId, v), () => { setV(blank); setOpen(false); })}>Save commission</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <Err e={error} />
    </div>
  );
}

function Detail({ row }: { row: Row }) {
  const { pending, error, run } = useAct();
  const [saved, setSaved] = useState(false);
  const [v, setV] = useState({ signedUpOn: row.t?.signedUpOn ?? "", vendorRef: row.t?.vendorRef ?? "", followUpOn: row.t?.followUpOn ?? "", notes: row.t?.notes ?? "" });
  const set = (k: keyof typeof v, val: string) => { setV({ ...v, [k]: val }); setSaved(false); };
  if (row.stage === "declined") return <p className="text-sm text-dim">Declined {date(row.r.decidedAt)}{row.r.message ? `: ${row.r.message}` : "."}</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="label">Follow-up with the vendor</div>
        <p className="text-xs text-mute">Sent {date(row.r.decidedAt)}{row.r.accessLink ? ` · ${row.r.accessLink}` : ""}{row.r.accessCode ? ` · code ${row.r.accessCode}` : ""}</p>
        {row.terms?.verifyWhere && <p className="text-xs text-dim"><span className="text-mute">Where to check sign-ups: </span>{row.terms.verifyWhere}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <F label="Signed up on"><input type="date" className="input" value={v.signedUpOn} onChange={(e) => set("signedUpOn", e.target.value)} /></F>
          <F label="Vendor's account reference"><input className="input" value={v.vendorRef} onChange={(e) => set("vendorRef", e.target.value)} /></F>
          <F label="Next follow-up"><input type="date" className="input" value={v.followUpOn} onChange={(e) => set("followUpOn", e.target.value)} /></F>
          <F label="Notes" wide><textarea className="input" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></F>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(() => A.saveTracking(row.r.id, v), () => setSaved(true))}>Save</button>
          {saved && <span className="text-xs text-good">Saved</span>}
        </div>
        <Err e={error} />
      </div>
      <div className="space-y-3">
        <div className="label">Commissions{row.terms?.commissionRate ? ` · agreed ${row.terms.commissionRate}` : ""}</div>
        {row.pays.length === 0 ? <p className="text-sm text-mute">Nothing recorded yet. Add an entry when the vendor reports what is owed.</p> : <ul>{row.pays.map((p) => <PaymentLine key={p.id} p={p} />)}</ul>}
        <AddPayment requestId={row.r.id} />
      </div>
    </div>
  );
}

export function RequestsTab({ desk }: { desk: Desk }) {
  const rows = useRows(desk);
  const waiting = rows.filter((x) => x.stage === "requested");
  const [stage, setStage] = useState<"all" | ReferralStage>("all");
  const [partner, setPartner] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rest = rows.filter((x) => x.stage !== "requested").filter((x) => (stage === "all" || x.stage === stage) && (partner === "all" || x.r.partnerId === partner) && (!q || `${x.r.tenantName} ${x.r.requesterName} ${x.r.requesterEmail} ${x.partner?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const used = desk.partners.filter((p) => rows.some((x) => x.r.partnerId === p.id));
  return (
    <div className="space-y-8">
      <section>
        <h2 className="title text-base mb-3">Waiting for approval <span className="text-mute tabular-nums">{waiting.length}</span></h2>
        {waiting.length === 0 ? <div className="card p-5 text-sm text-dim">No open requests. New ones appear here as soon as a student asks.</div> : <div className="space-y-3">{waiting.map((x) => <Approve key={x.r.id} row={x} />)}</div>}
      </section>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h2 className="title text-base">All referrals</h2>
          <div className="flex flex-wrap gap-2">
            <input className="input w-44" placeholder="Search brand or student" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search referrals" />
            <select className="input w-40" value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} aria-label="Filter by status">
              <option value="all">Every status</option>
              {(["sent", "signed_up", "due", "paid", "declined"] as const).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
            <select className="input w-44" value={partner} onChange={(e) => setPartner(e.target.value)} aria-label="Filter by partner">
              <option value="all">Every partner</option>
              {used.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        {rest.length === 0 ? <div className="card p-5 text-sm text-dim">Nothing here yet.</div> : (
          <div className="card overflow-hidden">
            {rest.map((x) => (
              <div key={x.r.id} className="border-t border-line first:border-t-0">
                <button type="button" className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-elev" aria-expanded={open === x.r.id} onClick={() => setOpen(open === x.r.id ? null : x.r.id)}>
                  <span className="flex-1 min-w-48">
                    <span className="block text-sm text-ink font-medium">{x.r.tenantName || "Unnamed brand"} → {x.partner?.name ?? "removed partner"}</span>
                    <span className="block text-xs text-mute">{x.r.requesterName} · {x.r.requesterEmail} · asked {date(x.r.createdAt)}</span>
                  </span>
                  {x.t?.followUpOn && x.stage !== "paid" && <span className={`text-xs ${x.t.followUpOn <= today() ? "text-bad" : "text-mute"}`}>Follow up {date(x.t.followUpOn)}</span>}
                  {(x.due > 0 || x.paid > 0) && <span className="text-xs tabular-nums text-dim">{x.due > 0 && <span className="text-warn">{money(x.due)} due</span>}{x.due > 0 && x.paid > 0 && " · "}{x.paid > 0 && <span>{money(x.paid)} paid</span>}</span>}
                  <span className={`pill pill-${STAGE_TONE[x.stage]}`}>{STAGE_LABEL[x.stage]}</span>
                  <ChevronDown size={15} className={`text-mute ${open === x.r.id ? "rotate-180" : ""}`} />
                </button>
                {open === x.r.id && <div className="px-4 pb-5 pt-1 bg-elev"><Detail row={x} /></div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Commissions ----------

export function CommissionsTab({ desk }: { desk: Desk }) {
  const rows = useRows(desk);
  const groups = desk.partners.map((p) => ({ p, terms: desk.terms.find((t) => t.partnerId === p.id), rows: rows.filter((x) => x.r.partnerId === p.id && x.stage !== "declined" && x.stage !== "requested") })).filter((g) => g.rows.length > 0).sort((a, b) => b.rows.reduce((s, x) => s + x.due, 0) - a.rows.reduce((s, x) => s + x.due, 0));
  if (groups.length === 0) return <div className="card p-5 text-sm text-dim">Once a referral has been sent, the partner shows up here with what is owed and who to chase.</div>;
  return (
    <div className="space-y-4">
      {groups.map(({ p, terms, rows: rs }) => {
        const due = rs.reduce((s, x) => s + x.due, 0), paid = rs.reduce((s, x) => s + x.paid, 0);
        const unconfirmed = rs.filter((x) => x.stage === "sent").length;
        return (
          <section key={p.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <h2 className="title text-base">{p.name}</h2>
                <div className="text-xs text-mute mt-0.5">{[terms?.commissionRate && `Commission ${terms.commissionRate}${terms.commissionType === "recurring" ? ", recurring" : terms.commissionType === "one_time" ? ", one-time" : ""}`, terms?.payoutSchedule, terms?.howCollected].filter(Boolean).join(" · ") || "No commission terms saved. Add them on the Partners tab."}</div>
                <div className="text-xs text-dim mt-1">{terms?.contactName || terms?.contactEmail || terms?.contactPhone ? <>Contact: {[terms.contactName, terms.contactEmail, terms.contactPhone].filter(Boolean).join(" · ")}</> : "No contact saved"}</div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="tabular-nums"><span className="text-mute text-xs block">Due</span><span className={due > 0 ? "text-warn font-medium" : "text-dim"}>{money(due)}</span></span>
                <span className="tabular-nums"><span className="text-mute text-xs block">Paid</span><span className="text-dim">{money(paid)}</span></span>
                <a className="btn btn-ghost text-xs" href={`/admin/referrals/export?partner=${p.id}`}><Download size={13} /> CSV</a>
              </div>
            </div>
            {unconfirmed > 0 && <p className="px-4 py-2 text-xs text-info bg-elev border-t border-line">{unconfirmed} referral{unconfirmed === 1 ? "" : "s"} sent but not confirmed as signed up. Ask the vendor{terms?.verifyWhere ? ` or check: ${terms.verifyWhere}` : ""}.</p>}
            <ul className="border-t border-line">
              {rs.map((x) => (
                <li key={x.r.id} className="px-4 py-3 border-t border-line first:border-t-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-ink">{x.r.tenantName || "Unnamed brand"} <span className="text-mute text-xs">· {x.r.requesterEmail}{x.t?.vendorRef ? ` · ${x.t.vendorRef}` : ""}</span></span>
                    <span className={`pill pill-${STAGE_TONE[x.stage]}`}>{STAGE_LABEL[x.stage]}</span>
                  </div>
                  {x.pays.length > 0 && <ul className="mt-1">{x.pays.map((pay) => <PaymentLine key={pay.id} p={pay} />)}</ul>}
                  <div className="mt-2"><AddPayment requestId={x.r.id} /></div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ---------- Partners ----------

function PartnerForm({ partner, categories, onDone }: { partner?: Partner; categories: string[]; onDone: () => void }) {
  const { pending, error, run } = useAct();
  const [v, setV] = useState({ name: partner?.name ?? "", category: partner?.category ?? "", description: partner?.description ?? "", website: partner?.website ?? "", listed: partner?.listed ?? true });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Partner name"><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></F>
        <F label="Category"><input className="input" list="partner-categories" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="Payment Processing" /><datalist id="partner-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></F>
        <F label="What students see about it" wide><textarea className="input" rows={2} maxLength={600} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="One or two lines on what it does and who it suits" /></F>
        <F label="Website (optional)"><input className="input" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} placeholder="https://" /></F>
        <label className="flex items-center gap-2 text-sm text-dim self-end pb-2"><input type="checkbox" checked={v.listed} onChange={(e) => setV({ ...v, listed: e.target.checked })} /> Show to students</label>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => A.savePartner({ id: partner?.id, ...v }), onDone)}>{partner ? "Save partner" : "Add partner"}</button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
      <Err e={error} />
    </div>
  );
}

function AgreementForm({ partner, terms, onDone }: { partner: Partner; terms: PartnerTerms | undefined; onDone: () => void }) {
  const { pending, error, run, setError } = useAct();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<A.TermsInput>({
    contactName: terms?.contactName ?? "", contactEmail: terms?.contactEmail ?? "", contactPhone: terms?.contactPhone ?? "",
    agreementStatus: terms?.agreementStatus ?? "none", commissionRate: terms?.commissionRate ?? "", commissionType: terms?.commissionType ?? "unknown",
    howCollected: terms?.howCollected ?? "", payoutSchedule: terms?.payoutSchedule ?? "", referralLink: terms?.referralLink ?? "", referralCode: terms?.referralCode ?? "",
    verifyWhere: terms?.verifyWhere ?? "", notes: terms?.notes ?? "", agreementDate: terms?.agreementDate ?? "",
  });
  const set = <K extends keyof A.TermsInput>(k: K, val: A.TermsInput[K]) => setV((o) => ({ ...o, [k]: val }));
  const save = async () => {
    let upload: { agreementPath?: string; agreementName?: string } = {};
    if (file) {
      if (file.size > 20 * 1024 * 1024) return setError("The file is over 20 MB.");
      setBusy(true);
      const slot = await A.agreementUploadSlot(partner.id, file.name);
      if (!slot.ok) { setBusy(false); return setError(slot.error); }
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from("partner-agreements").uploadToSignedUrl(slot.path, slot.token, file);
      setBusy(false);
      if (up.error) return setError(up.error.message);
      upload = { agreementPath: slot.path, agreementName: file.name };
    }
    run(() => A.saveAgreement(partner.id, { ...v, ...upload }), onDone);
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Where it stands"><select className="input" value={v.agreementStatus} onChange={(e) => set("agreementStatus", e.target.value as A.TermsInput["agreementStatus"])}>{(["none", "in_talks", "agreed"] as const).map((s) => <option key={s} value={s}>{AGREEMENT_LABEL[s]}</option>)}</select></F>
        <F label="Date agreed"><input type="date" className="input" value={v.agreementDate} onChange={(e) => set("agreementDate", e.target.value)} /></F>
        <F label="Commission"><input className="input" value={v.commissionRate} onChange={(e) => set("commissionRate", e.target.value)} placeholder="10% of fees, or $250 per account" /></F>
        <F label="Paid how often"><select className="input" value={v.commissionType} onChange={(e) => set("commissionType", e.target.value as A.TermsInput["commissionType"])}><option value="unknown">Not decided</option><option value="one_time">Once per referral</option><option value="recurring">Recurring, while the student stays a customer</option></select></F>
        <F label="How the commission is collected" wide><input className="input" value={v.howCollected} onChange={(e) => set("howCollected", e.target.value)} placeholder="They wire it after their monthly report; we invoice them; paid through their affiliate dashboard" /></F>
        <F label="Payout schedule"><input className="input" value={v.payoutSchedule} onChange={(e) => set("payoutSchedule", e.target.value)} placeholder="Monthly, by the 15th" /></F>
        <F label="Where to check sign-ups"><input className="input" value={v.verifyWhere} onChange={(e) => set("verifyWhere", e.target.value)} placeholder="Partner portal, or ask the contact" /></F>
        <F label="Referral link"><input className="input" value={v.referralLink} onChange={(e) => set("referralLink", e.target.value)} placeholder="https://" /></F>
        <F label="Referral code"><input className="input" value={v.referralCode} onChange={(e) => set("referralCode", e.target.value)} /></F>
        <F label="Contact name"><input className="input" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} /></F>
        <F label="Contact email"><input className="input" type="email" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></F>
        <F label="Contact phone"><input className="input" value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></F>
        <F label="Agreement document (PDF, Word or image)">
          <input type="file" className="input" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {terms?.agreementName && <span className="block text-xs text-mute mt-1">On file: {terms.agreementName}. Choosing a new file replaces it.</span>}
        </F>
        <F label="Notes" wide><textarea className="input" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything agreed by email or on a call that is not in the document" /></F>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={pending || busy} onClick={save}>{busy ? "Uploading…" : pending ? "Saving…" : "Save agreement"}</button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
      <Err e={error} />
    </div>
  );
}

function PartnerRow({ p, terms, categories, count }: { p: Partner; terms: PartnerTerms | undefined; categories: string[]; count: number }) {
  const { pending, error, run, setError } = useAct();
  const [mode, setMode] = useState<"idle" | "edit" | "agreement">("idle");
  const hasTerms = Boolean(terms && (terms.agreementStatus !== "none" || terms.commissionRate || terms.agreementPath));
  const openFile = async () => { const r = await A.agreementDownloadUrl(p.id); if (r.ok) window.open(r.url, "_blank", "noopener"); else setError(r.error); };
  return (
    <li className="border-t border-line first:border-t-0 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex-1 min-w-48">
          <div className="text-sm text-ink font-medium">{p.name} {!p.listed && <span className="text-xs text-mute font-normal">· hidden from students</span>}</div>
          <div className="text-xs text-mute">{[terms?.commissionRate && `Commission ${terms.commissionRate}`, terms?.contactName && `Contact ${terms.contactName}`, terms?.referralLink || terms?.referralCode ? "Link or code saved" : "No link or code yet", count > 0 && `${count} referral${count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</div>
        </div>
        <span className={`pill pill-${terms?.agreementStatus === "agreed" ? "good" : terms?.agreementStatus === "in_talks" ? "gold" : "mute"}`}>{AGREEMENT_LABEL[terms?.agreementStatus ?? "none"]}</span>
        <div className="flex flex-wrap gap-2">
          {terms?.agreementPath && <button type="button" className="btn btn-ghost text-xs" onClick={openFile}><FileText size={13} /> Document</button>}
          <button type="button" className="btn btn-secondary text-xs" onClick={() => setMode(mode === "agreement" ? "idle" : "agreement")}>{hasTerms ? "Edit agreement" : <><Plus size={13} /> Add agreement</>}</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setMode(mode === "edit" ? "idle" : "edit")}>Edit</button>
          <button type="button" className="btn btn-ghost text-xs" disabled={pending} onClick={() => run(() => A.setPartnerListed(p.id, !p.listed))}>{p.listed ? "Hide" : "Show"}</button>
        </div>
      </div>
      {mode === "edit" && (
        <div className="mt-4 space-y-3">
          <PartnerForm partner={p} categories={categories} onDone={() => setMode("idle")} />
          {count === 0 && <button type="button" className="text-xs text-mute hover:text-bad underline" disabled={pending} onClick={() => { if (window.confirm(`Delete ${p.name}? This also removes its agreement details.`)) run(() => A.deletePartner(p.id)); }}>Delete this partner</button>}
        </div>
      )}
      {mode === "agreement" && <div className="mt-4"><AgreementForm partner={p} terms={terms} onDone={() => setMode("idle")} /></div>}
      <Err e={error} />
    </li>
  );
}

export function PartnersTab({ desk }: { desk: Desk }) {
  const [adding, setAdding] = useState(false);
  const categories = [...new Set(desk.partners.map((p) => p.category))].sort();
  const terms = new Map(desk.terms.map((t) => [t.partnerId, t]));
  const counts = new Map<string, number>();
  for (const r of desk.requests) counts.set(r.partnerId, (counts.get(r.partnerId) ?? 0) + 1);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-dim max-w-2xl">Students see the name, category and description only. Commission, contacts, links and documents stay on this side.</p>
        {!adding && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={14} /> Add partner</button>}
      </div>
      {adding && <div className="card p-4"><PartnerForm categories={categories} onDone={() => setAdding(false)} /></div>}
      {categories.map((c) => (
        <section key={c}>
          <h2 className="label mb-2">{c}</h2>
          <ul className="card overflow-hidden">{desk.partners.filter((p) => p.category === c).map((p) => <PartnerRow key={p.id} p={p} terms={terms.get(p.id)} categories={categories} count={counts.get(p.id) ?? 0} />)}</ul>
        </section>
      ))}
    </div>
  );
}

// ---------- Team ----------

export function TeamTab({ desk }: { desk: Desk }) {
  const { pending, error, run, setError } = useAct();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const invite = async () => { setLink(null); const r = await A.inviteAssistant(email, name); if (r.ok) { setLink(r.link); setEmail(""); setName(""); setError(null); } else setError(r.error); };
  return (
    <div className="space-y-5 max-w-2xl">
      <p className="text-sm text-dim">An assistant can open this referral desk and nothing else: no student numbers, no coaching calls, no brand pages. Coaches already have access.</p>
      <div className="card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></F>
          <F label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></F>
        </div>
        <button type="button" className="btn btn-primary" disabled={pending || !email} onClick={invite}>Give access</button>
        {link && <div className="rounded-lg bg-elev p-3 space-y-2"><p className="text-sm text-dim">Send them this link to set a password. It works once.</p><code className="block text-xs text-ink break-all">{link}</code><CopyBtn text={link} label="Copy link" /></div>}
        <Err e={error} />
      </div>
      {desk.staff.length > 0 && (
        <ul className="card overflow-hidden">
          {desk.staff.map((s) => (
            <li key={s.userId} className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line first:border-t-0">
              <span className="text-sm text-ink">{s.name || s.email} {s.name && <span className="text-mute text-xs">· {s.email}</span>}</span>
              <button type="button" className="btn btn-ghost text-xs" disabled={pending} onClick={() => { if (window.confirm(`Remove ${s.email} from the referral desk?`)) run(() => A.removeAssistant(s.userId)); }}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
