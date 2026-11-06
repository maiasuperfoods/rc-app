"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Link2, Plus, Trash2, UserPlus } from "lucide-react";
import { inviteCoach, inviteStudent, removeStudent, resetLink } from "./actions";

type Person = { user_id: string; email?: string; name?: string; last_sign_in_at?: string | null };
export type AccessData = {
  brands: { id: string; name: string; stage: string; active: boolean; created_at: string; students: Person[] }[];
  coaches: (Person & { role: string })[];
  invites: { email: string; tenant_id: string | null; role: string; created_at: string }[];
};

function ago(iso?: string | null) {
  if (!iso) return "Never signed in";
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "Signed in today" : `Signed in ${d}d ago`;
}

/** Shows a one-time link to copy and send to the person (WhatsApp, Slack, email…). */
function LinkBox({ link, note, onClose }: { link: string; note?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card-elev border border-gold/40 p-4 mt-4">
      <div className="flex items-center gap-2 text-sm text-ink font-medium mb-1"><Link2 size={14} className="text-gold" /> Send this link to them</div>
      <p className="text-xs text-dim mb-3">It signs them in once so they can set their password. It works one time and expires in 24 hours. {note}</p>
      <div className="flex gap-2">
        <input readOnly value={link} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button type="button" className="text-xs text-mute hover:text-ink mt-3" onClick={onClose}>Done</button>
    </div>
  );
}

export function AccessManager({ data, meId }: { data: AccessData; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<{ link: string; note?: string; at: string } | null>(null);
  const [newBrand, setNewBrand] = useState({ name: "", email: "" });
  const [addTo, setAddTo] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [coachEmail, setCoachEmail] = useState("");

  const act = (at: string, fn: () => Promise<{ ok: boolean; error?: string; link?: string; note?: string }>, after?: () => void) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setErr(r.error ?? "Failed");
      if (r.link) setLink({ link: r.link, note: r.note, at });
      after?.();
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {err && <div className="rounded-md bg-bad-dim text-bad text-sm px-3 py-2">{err}</div>}

      <section className="card p-5">
        <h2 className="text-sm font-medium text-ink flex items-center gap-2 mb-1"><Plus size={15} className="text-gold" /> Add a brand and invite its student</h2>
        <p className="text-xs text-dim mb-4">Creates the brand and an account for the student. They only ever see this brand.</p>
        <form
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            act("new", () => inviteStudent({ email: newBrand.email, brandName: newBrand.name }), () => setNewBrand({ name: "", email: "" }));
          }}
        >
          <input className="input" placeholder="Brand name" value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} required />
          <input className="input" type="email" placeholder="Student email" value={newBrand.email} onChange={(e) => setNewBrand({ ...newBrand, email: e.target.value })} required />
          <button className="btn btn-primary justify-center" disabled={pending}><UserPlus size={14} /> Invite</button>
        </form>
        {link?.at === "new" && <LinkBox {...link} onClose={() => setLink(null)} />}
      </section>

      <section>
        <h2 className="label mb-3">Brands · {data.brands.length}</h2>
        {data.brands.length === 0 ? (
          <div className="card p-6 text-sm text-dim">No brands yet. Add the first one above.</div>
        ) : (
          <div className="space-y-3">
            {data.brands.map((b) => (
              <div key={b.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-ink font-medium">{b.name}</div>
                    <div className="text-xs text-mute">{b.students.length} student{b.students.length === 1 ? "" : "s"}</div>
                  </div>
                  <button type="button" className="btn btn-ghost !py-1 !px-2.5 !text-xs" onClick={() => { setAddTo(addTo === b.id ? null : b.id); setAddEmail(""); }}>
                    <UserPlus size={12} /> Add student
                  </button>
                </div>
                {addTo === b.id && (
                  <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); act(b.id, () => inviteStudent({ email: addEmail, tenantId: b.id }), () => setAddTo(null)); }}>
                    <input className="input" type="email" placeholder="Student email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} required autoFocus />
                    <button className="btn btn-primary shrink-0" disabled={pending}>Invite</button>
                  </form>
                )}
                {b.students.length > 0 && (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {b.students.map((s) => (
                      <li key={s.user_id} className="flex items-center gap-3 py-2.5 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="text-ink truncate">{s.name || s.email}</div>
                          <div className="text-xs text-mute truncate">{s.name ? `${s.email} · ` : ""}{ago(s.last_sign_in_at)}</div>
                        </div>
                        <button type="button" title="Create a password reset link" className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={pending} onClick={() => act(b.id, () => resetLink(s.email ?? ""))}>
                          <KeyRound size={12} /> Reset link
                        </button>
                        <button type="button" title="Remove access to this brand" className="btn btn-ghost !py-1 !px-2 !text-xs text-bad" disabled={pending} onClick={() => confirm(`Remove ${s.email} from ${b.name}?`) && act(b.id, () => removeStudent(b.id, s.user_id))}>
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {link?.at === b.id && <LinkBox {...link} onClose={() => setLink(null)} />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-medium text-ink mb-1">Coaches · {data.coaches.length}</h2>
        <p className="text-xs text-dim mb-3">Coaches see every brand, read-only, and can invite students.</p>
        <ul className="divide-y divide-line border-y border-line mb-4">
          {data.coaches.map((c) => (
            <li key={c.user_id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <div className="text-ink truncate">{c.name || c.email}{c.user_id === meId && <span className="text-mute"> (you)</span>}</div>
                <div className="text-xs text-mute truncate">{c.role === "admin" ? "Owner" : "Coach"} · {ago(c.last_sign_in_at)}</div>
              </div>
              {c.user_id !== meId && (
                <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={pending} onClick={() => act("coach", () => resetLink(c.email ?? ""))}><KeyRound size={12} /> Reset link</button>
              )}
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act("coach", () => inviteCoach(coachEmail), () => setCoachEmail("")); }}>
          <input className="input" type="email" placeholder="Coach email" value={coachEmail} onChange={(e) => setCoachEmail(e.target.value)} required />
          <button className="btn btn-secondary shrink-0" disabled={pending}><UserPlus size={14} /> Invite coach</button>
        </form>
        {link?.at === "coach" && <LinkBox {...link} onClose={() => setLink(null)} />}
      </section>
    </div>
  );
}
