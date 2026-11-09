"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Copy, RefreshCw, Sparkles } from "lucide-react";
import * as A from "@/app/(app)/admin/coaching-actions";
import { KNOWN_METRICS, type PcActionItem, type PcCall, type PcInitiative, type PcStudent } from "@/lib/pc/types";
import { fmtD, fmtDT } from "./format";

type Result = { ok: true; data?: unknown } | { ok: false; error: string };

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<Result>, after?: (r: Result) => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else { router.refresh(); after?.(r); }
    });
  return { pending, error, act };
}

const Err = ({ error }: { error: string | null }) => (error ? <p className="text-xs text-bad mt-2">{error}</p> : null);

// ---------- Progress tab ----------
export function AgendaButton({ studentId }: { studentId: string }) {
  const { pending, error, act } = useAct();
  const [agenda, setAgenda] = useState<string[] | null>(null);
  return (
    <div>
      <button type="button" className="btn btn-ghost !py-1.5" disabled={pending} onClick={() => act(() => A.agenda(studentId), (r) => setAgenda((r as { data?: string[] }).data ?? []))}>
        <Sparkles size={14} /> {pending ? "Drafting…" : "Draft agenda"}
      </button>
      <Err error={error} />
      {agenda && <ol className="list-decimal pl-5 mt-3 space-y-1 text-sm text-ink">{agenda.map((x, i) => <li key={i}>{x}</li>)}</ol>}
    </div>
  );
}

const COLS: [PcInitiative["status"], string][] = [["planned", "Planned"], ["in_progress", "In progress"], ["done", "Done"], ["parked", "Parked"]];
export function InitiativeStatus({ initiative }: { initiative: PcInitiative }) {
  const { pending, act } = useAct();
  return (
    <select className="input !w-auto !py-0.5 !px-2 text-xs" defaultValue={initiative.status} disabled={pending} onChange={(e) => act(() => A.updateInitiative(initiative.id, { status: e.target.value }))}>
      {COLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}
export function AddInitiative({ studentId }: { studentId: string }) {
  const { pending, error, act } = useAct();
  const [name, setName] = useState("");
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(() => A.addInitiative(studentId, name.trim()), () => setName("")); }}>
      <input className="input !w-56 !py-1.5" placeholder="New initiative" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn btn-ghost !py-1.5" disabled={pending}>Add</button>
      <Err error={error} />
    </form>
  );
}
export function LogNumbers({ studentId }: { studentId: string }) {
  const { pending, error, act } = useAct();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ metric: "revenue_30d", value: "", as_of: new Date().toISOString().slice(0, 10) });
  return (
    <div>
      <button type="button" className="btn btn-ghost !py-1.5" onClick={() => setOpen(!open)}>Log numbers {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
      {open && (
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] mt-3 p-3 rounded-lg border border-line" onSubmit={(e) => { e.preventDefault(); act(() => A.logMetric(studentId, f.metric, f.value, f.as_of), () => setF({ ...f, value: "" })); }}>
          <select className="input" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{Object.entries(KNOWN_METRICS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className="input" inputMode="decimal" placeholder="Value" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required />
          <input className="input" type="date" value={f.as_of} onChange={(e) => setF({ ...f, as_of: e.target.value })} />
          <button className="btn btn-secondary" disabled={pending}>Save</button>
          <Err error={error} />
        </form>
      )}
    </div>
  );
}
export function CheckinButton({ studentId }: { studentId: string }) {
  const { pending, error, act } = useAct();
  const [sent, setSent] = useState(false);
  return (
    <div>
      <button type="button" className="btn btn-ghost !py-1.5" disabled={pending} onClick={() => act(() => A.sendCheckin(studentId), () => setSent(true))}>{sent ? <><Check size={14} /> Sent</> : "Send check-in"}</button>
      <Err error={error} />
    </div>
  );
}

// ---------- Calls tab ----------
export function CallRow({ call }: { call: PcCall }) {
  const [open, setOpen] = useState(false);
  const { pending, error, act } = useAct();
  const [queued, setQueued] = useState(false);
  return (
    <div className="py-3 border-b border-line last:border-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b className="text-ink font-medium">{fmtDT(call.scheduled_at || call.ended_at || call.created_at)}</b>
        <span className="pill">{call.kind}</span>
        <span className="pill">{call.status}</span>
        <span className="text-xs text-mute">{call.source}</span>
        {call.recording_url && <a className="text-gold-soft text-xs" href={call.recording_url} target="_blank" rel="noreferrer">recording</a>}
        {call.meeting_url && call.status === "scheduled" && <a className="text-gold-soft text-xs" href={call.meeting_url} target="_blank" rel="noreferrer">join</a>}
        {call.transcript && (
          <>
            <button type="button" className="text-xs text-gold-soft" onClick={() => setOpen(!open)}>{open ? "hide transcript" : "transcript"}</button>
            <button type="button" className="text-xs text-mute hover:text-ink inline-flex items-center gap-1" disabled={pending || queued} onClick={() => act(() => A.resummarizeCall(call.id), () => setQueued(true))}><RefreshCw size={11} /> {queued ? "re-summarized" : pending ? "working…" : "re-summarize"}</button>
          </>
        )}
      </div>
      {call.summary ? <p className="text-sm text-dim mt-2 whitespace-pre-wrap">{call.summary}</p> : call.transcript ? <p className="text-xs text-mute mt-2">Summary pending…</p> : null}
      {open && call.transcript && <pre className="mt-2 text-xs text-dim whitespace-pre-wrap max-h-96 overflow-auto bg-elev rounded-lg p-3 leading-relaxed font-sans">{call.transcript}</pre>}
      <Err error={error} />
    </div>
  );
}
export function AddCallForm({ students, defaultStudentId }: { students: { id: string; first_name: string; last_name: string }[]; defaultStudentId?: string }) {
  const { pending, error, act } = useAct();
  const [f, setF] = useState({ student_id: defaultStudentId ?? "", date: "", recording_url: "", transcript: "" });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => A.addCall(f.student_id, { transcript: f.transcript, date: f.date || null, recording_url: f.recording_url || null }), () => setF({ ...f, transcript: "", recording_url: "", date: "" })); }}>
      <div className="grid gap-2 sm:grid-cols-3">
        {!defaultStudentId && <select className="input" value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })} required><option value="">Choose a student…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select>}
        <input className="input" type="datetime-local" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <input className="input" placeholder="Recording link (optional)" value={f.recording_url} onChange={(e) => setF({ ...f, recording_url: e.target.value })} />
      </div>
      <textarea className="input min-h-40" placeholder="Paste the transcript. A summary, numbers, initiatives and commitments are extracted automatically." value={f.transcript} onChange={(e) => setF({ ...f, transcript: e.target.value })} required />
      <button className="btn btn-secondary" disabled={pending}>{pending ? "Processing…" : "Add call"}</button>
      <Err error={error} />
    </form>
  );
}
export function AssignCall({ callId, students, current }: { callId: string; students: { id: string; first_name: string; last_name: string }[]; current: string | null }) {
  const { pending, error, act } = useAct();
  return (
    <div>
      <select className="input !w-auto !py-0.5 !px-2 text-xs" value="" disabled={pending} onChange={(e) => { const v = e.target.value; if (!v) return; if (current && !confirm("Move this call to another student? Items and numbers it created will be redone for the new student.")) return; act(() => A.assignCall(callId, v)); }}>
        <option value="">{current ? "reassign…" : "Assign…"}</option>
        {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
      </select>
      <Err error={error} />
    </div>
  );
}
export function FirefliesImport() {
  const { pending, error, act } = useAct();
  const [id, setId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="flex gap-2 flex-wrap" onSubmit={(e) => { e.preventDefault(); act(() => A.importFireflies(id.trim()), (r) => { const d = (r as { data?: { matched: boolean } }).data; setMsg(d?.matched ? "Imported and attached to a student." : "Imported — no matching student; assign it in the list."); setId(""); }); }}>
      <input className="input !w-80" placeholder="Fireflies meeting ID" value={id} onChange={(e) => setId(e.target.value)} required />
      <button className="btn btn-ghost" disabled={pending}>{pending ? "Importing…" : "Import"}</button>
      {msg && <span className="text-xs text-dim self-center">{msg}</span>}
      <Err error={error} />
    </form>
  );
}

// ---------- Action items tab ----------
export function ActionItemRow({ item }: { item: PcActionItem }) {
  const { pending, error, act } = useAct();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ text: item.text, due_on: item.due_on ?? "", owner: item.owner });
  const closed = item.status !== "open";
  return (
    <tr className={closed ? "opacity-50" : ""}>
      <td className="w-[55%]">
        {edit ? <textarea className="input min-h-16" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /> : <>{item.text}{item.source_call_id && <div className="text-xs text-mute">from call</div>}</>}
        <Err error={error} />
      </td>
      <td className="num w-36">{edit ? <input className="input" type="date" value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} /> : <span className={!closed && item.due_on && new Date(item.due_on) < new Date() ? "text-bad" : ""}>{fmtD(item.due_on)}</span>}</td>
      <td className="w-44">{edit ? <select className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value as "student" | "founder" })}><option value="student">Student</option><option value="founder">RC Team</option></select> : item.status}</td>
      <td className="text-right whitespace-nowrap">
        {edit ? (
          <>
            <button type="button" className="btn btn-primary !py-1 !px-2 !text-xs" disabled={pending} onClick={() => act(() => A.updateActionItem(item.id, { text: f.text, due_on: f.due_on || null, owner: f.owner }), () => setEdit(false))}>save</button>{" "}
            <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" onClick={() => setEdit(false)}>cancel</button>
          </>
        ) : (
          <>
            {item.status === "open" ? (
              <>
                <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs text-good" disabled={pending} onClick={() => act(() => A.updateActionItem(item.id, { status: "done" }))}>done</button>{" "}
                <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={pending} onClick={() => act(() => A.updateActionItem(item.id, { status: "dropped" }))}>drop</button>{" "}
              </>
            ) : (
              <><button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={pending} onClick={() => act(() => A.updateActionItem(item.id, { status: "open" }))}>reopen</button>{" "}</>
            )}
            <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" onClick={() => setEdit(true)}>edit</button>
          </>
        )}
      </td>
    </tr>
  );
}
export function AddActionItem({ studentId }: { studentId: string }) {
  const { pending, error, act } = useAct();
  const [f, setF] = useState({ owner: "student" as "student" | "founder", text: "", due_on: "" });
  return (
    <form className="grid gap-2 sm:grid-cols-[180px_1fr_160px_auto] items-end" onSubmit={(e) => { e.preventDefault(); act(() => A.addActionItem(studentId, { owner: f.owner, text: f.text, due_on: f.due_on || null }), () => setF({ ...f, text: "", due_on: "" })); }}>
      <select className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value as "student" | "founder" })}><option value="student">Student</option><option value="founder">RC Team</option></select>
      <input className="input" placeholder="Item" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} required />
      <input className="input" type="date" value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} />
      <button className="btn btn-secondary" disabled={pending}>Add</button>
      <Err error={error} />
    </form>
  );
}

// ---------- Intake / Profile ----------
export function CopyLink({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-ghost !py-1 !px-2 !text-xs" onClick={async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1500); } catch {} }}>
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? "Copied" : label}
    </button>
  );
}
export function ResetIntake({ studentId }: { studentId: string }) {
  const { pending, error, act } = useAct();
  return (
    <div>
      <button type="button" className="btn btn-ghost !py-1.5 text-bad" disabled={pending} onClick={() => confirm("Delete all intake answers for this student? They will need to fill it in again.") && act(() => A.resetIntake(studentId))}>Reset intake</button>
      <Err error={error} />
    </div>
  );
}
export function ProfileForm({ student }: { student: PcStudent }) {
  const { pending, error, act } = useAct();
  const [f, setF] = useState({ status: student.status, lead_founder: student.lead_founder ?? "", booking_url: student.booking_url ?? "", notes: student.notes ?? "" });
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => A.saveStudent(student.id, f), () => { setSaved(true); setTimeout(() => setSaved(false), 1500); }); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="label block mb-1.5">Status</span><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as PcStudent["status"] })}>{["signed", "active", "paused", "cancelled"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="block"><span className="label block mb-1.5">Lead coach</span><input className="input" value={f.lead_founder} onChange={(e) => setF({ ...f, lead_founder: e.target.value })} placeholder="Name" /></label>
        <label className="block"><span className="label block mb-1.5">Booking URL</span><input className="input" value={f.booking_url} onChange={(e) => setF({ ...f, booking_url: e.target.value })} /></label>
      </div>
      <label className="block"><span className="label block mb-1.5">Internal notes</span><textarea className="input min-h-24" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn btn-secondary" disabled={pending}>{saved ? <><Check size={14} /> Saved</> : "Save"}</button>
        {!student.paid_at ? (
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => confirm("Mark as paid and send the welcome email with intake + booking links?") && act(() => A.markPaid(student.id))}>Mark paid &amp; send welcome</button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => act(() => A.resendWelcome(student.id), () => setSent(true))}>{sent ? "Welcome email sent" : "Resend welcome email"}</button>
        )}
      </div>
      <Err error={error} />
    </form>
  );
}
export function ProvisionButton({ studentId, ready, children }: { studentId: string; ready: boolean; children?: ReactNode }) {
  const { pending, error, act } = useAct();
  const router = useRouter();
  return (
    <div>
      <button type="button" className={`btn ${ready ? "btn-primary" : "btn-ghost"}`} disabled={pending} onClick={() => (ready || confirm("This student hasn't paid or finished the intake yet. Create their brand and platform account anyway?")) && act(() => A.provisionNow(studentId), (r) => { const d = (r as { data?: { tenantId: string } }).data; if (d?.tenantId) router.push(`/admin/${d.tenantId}`); })}>
        {pending ? "Creating…" : children ?? "Create platform access"}
      </button>
      <Err error={error} />
    </div>
  );
}
export function AddStudentForm() {
  const { pending, error, act } = useAct();
  const router = useRouter();
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", company_name: "" });
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); act(() => A.addStudent(f), (r) => { const id = (r as { data?: string }).data; if (id) router.push(`/admin/pc/${id}`); }); }}>
      <input className="input" placeholder="First name" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} required />
      <input className="input" placeholder="Last name" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} required />
      <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      <input className="input" placeholder="Company (optional)" value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} />
      <button className="btn btn-ghost" disabled={pending}>Add</button>
      <Err error={error} />
    </form>
  );
}
