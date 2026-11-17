"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Copy, ExternalLink } from "lucide-react";
import type { Partner, ReferralRequest } from "@/lib/referrals-shared";
import { requestPartnerAccess } from "./actions";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-ghost text-xs" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked: the text is on screen */ } }}>
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? "Copied" : label}
    </button>
  );
}

function PartnerCard({ p, request, canRequest }: { p: Partner; request: ReferralRequest | undefined; canRequest: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = () => start(async () => { const r = await requestPartnerAccess(p.id, note); if (r.ok) { setOpen(false); setError(null); } else setError(r.error); });
  const declined = request?.status === "declined";

  return (
    <div className={`card p-4 flex flex-col gap-3 ${request?.status === "sent" ? "border-gold" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-ink font-medium">{p.name}</div>
          {p.description && <p className="text-sm text-dim mt-1">{p.description}</p>}
        </div>
        {request?.status === "requested" && <span className="pill pill-gold shrink-0"><Clock size={12} className="mr-1 inline" />Requested</span>}
        {request?.status === "sent" && <span className="pill pill-good shrink-0"><Check size={12} className="mr-1 inline" />Access sent</span>}
      </div>

      {request?.status === "requested" && <p className="text-xs text-mute">We have your request. Your access details will appear here once we have set it up with the partner.</p>}

      {request?.status === "sent" && (
        <div className="rounded-lg bg-elev p-3 space-y-2 text-sm">
          {request.message && <p className="text-dim whitespace-pre-line">{request.message}</p>}
          {request.accessLink && (
            <div className="flex flex-wrap items-center gap-2">
              <a href={request.accessLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open {p.name} <ExternalLink size={14} /></a>
              <CopyButton text={request.accessLink} label="Copy link" />
            </div>
          )}
          {request.accessCode && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-mute text-xs">Code</span>
              <code className="text-ink font-semibold tracking-wide">{request.accessCode}</code>
              <CopyButton text={request.accessCode} label="Copy code" />
            </div>
          )}
          <p className="text-xs text-mute">Use the link or code above when you sign up, so the partner knows you came through us.</p>
        </div>
      )}

      {declined && request?.message && <p className="text-xs text-dim">Last request: {request.message}</p>}

      {(!request || declined) && canRequest && !open && (
        <div><button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Request access</button></div>
      )}
      {open && (
        <div className="space-y-2">
          <label className="block">
            <span className="label block mb-1.5">Anything we should know? (optional)</span>
            <textarea className="input" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you need it for, your monthly volume, timing" />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={send}>{pending ? "Sending…" : "Send request"}</button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function PartnerList({ partners, requests, canRequest }: { partners: Partner[]; requests: ReferralRequest[]; canRequest: boolean }) {
  // The newest request per partner is the one that counts.
  const latest = new Map<string, ReferralRequest>();
  for (const r of requests) if (!latest.has(r.partnerId)) latest.set(r.partnerId, r);
  const cats = [...new Set(partners.map((p) => p.category))];
  return (
    <div className="space-y-8">
      {cats.map((c) => (
        <section key={c}>
          <h2 className="label mb-3">{c}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {partners.filter((p) => p.category === c).map((p) => <PartnerCard key={p.id} p={p} request={latest.get(p.id)} canRequest={canRequest} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
