"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import type { WbrItem, WbrItemType } from "@/lib/types";
import { addWbrItem, deleteWbrItem, setWbrNote, setWbrOwner, setWbrTarget, updateWbrItem } from "./actions";

/** A field that saves when you leave it, and says so. */
function useSaver() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        setError(null);
        await fn();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  return { pending, error, run };
}

export function TargetInput({ kpi, value, toStored, canEdit }: { kpi: string; value: number | null; toStored: "pct" | "raw"; canEdit: boolean }) {
  const { pending, error, run } = useSaver();
  const [v, setV] = useState(value == null ? "" : String(value));
  if (!canEdit) return <span className="tabular-nums text-dim">{value == null ? "—" : value}</span>;
  return (
    <input
      className={`input text-right py-1 px-1.5 text-xs w-20 tabular-nums ${pending ? "opacity-60" : ""} ${error ? "border-bad" : ""}`}
      inputMode="decimal"
      placeholder="set"
      title={error ?? "Target for this row. Leave empty for none."}
      aria-label="Target"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = v.trim() === "" ? null : Number(v);
        if (n != null && !Number.isFinite(n)) return setV(value == null ? "" : String(value));
        if (n === value) return;
        run(() => setWbrTarget(kpi, n == null ? null : toStored === "pct" ? n / 100 : n));
      }}
    />
  );
}

export function OwnerInput({ group, value, canEdit }: { group: string; value: string; canEdit: boolean }) {
  const { pending, run } = useSaver();
  const [v, setV] = useState(value);
  if (!canEdit) return <span className="text-xs text-dim">{value || "no owner"}</span>;
  return (
    <label className="flex items-center gap-2 text-xs text-mute font-normal normal-case tracking-normal">
      Owner
      <input className={`input py-1 px-2 text-xs w-36 ${pending ? "opacity-60" : ""}`} placeholder="who owns these" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== value && run(() => setWbrOwner(group, v))} />
    </label>
  );
}

export function NoteInput({ week, kpi, value, canEdit }: { week: string; kpi: string; value: string; canEdit: boolean }) {
  const { pending, error, run } = useSaver();
  const [v, setV] = useState(value);
  if (!canEdit) return <span className="text-sm text-dim">{value || "No line written yet."}</span>;
  return (
    <input
      className={`input py-1.5 text-sm w-full ${pending ? "opacity-60" : ""} ${error ? "border-bad" : ""}`}
      placeholder="One line: the cause, and the next step"
      title={error ?? undefined}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && run(() => setWbrNote(week, kpi, v))}
    />
  );
}

// ---- Board -----------------------------------------------------------------

const TYPES: { id: WbrItemType; label: string; hint: string; verb: string }[] = [
  { id: "task", label: "Tasks", verb: "task", hint: "Commitments with one owner and a date. Anything still open carries into next week on its own." },
  { id: "issue", label: "Issues", verb: "issue", hint: "Problems to solve on the call. Every issue ends as a task, a logged decision, or a deliberate park." },
  { id: "need", label: "Needs", verb: "need", hint: "Tools, access, budget or a decision someone is waiting on." },
  { id: "decision", label: "Decisions", verb: "decision", hint: "What was decided and why, so it is not argued again." },
];

const day = (iso: string | null) => (iso ? new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");

export function Board({ items, week, today, canEdit }: { items: WbrItem[]; week: string; today: string; canEdit: boolean }) {
  const [type, setType] = useState<WbrItemType>("task");
  const [show, setShow] = useState<"open" | "closed">("open");
  const [editing, setEditing] = useState<string | null>(null);
  const { pending, error, run } = useSaver();
  const form = useRef<HTMLFormElement>(null);
  const meta = TYPES.find((t) => t.id === type)!;
  const ofType = items.filter((i) => i.type === type);
  const open = ofType.filter((i) => i.status === "open").sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.createdAt.localeCompare(b.createdAt));
  const closed = ofType.filter((i) => i.status !== "open").sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
  const list = show === "open" ? open : closed;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => {
          const n = items.filter((i) => i.type === t.id && i.status === "open").length;
          return (
            <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => { setType(t.id); setEditing(null); }} className={`btn ${type === t.id ? "btn-primary" : "btn-ghost"}`}>
              {t.label}{n > 0 && <span className="ml-1.5 tabular-nums opacity-70">{n}</span>}
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="flex gap-1">
          {(["open", "closed"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className={`btn ${show === k ? "btn-secondary" : "btn-ghost"} text-xs`}>{k === "open" ? `Open ${open.length}` : `${type === "decision" ? "Archived" : "Closed"} ${closed.length}`}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-mute">{meta.hint}</p>

      <div className="card">
        {canEdit && (
          <form
            ref={form}
            className="grid gap-2 p-3 border-b border-line md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_150px_auto] items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const title = String(f.get("title") ?? "").trim();
              if (!title) return;
              run(async () => {
                await addWbrItem({ type, title, owner: String(f.get("owner") ?? ""), due: String(f.get("due") ?? "") || null, note: String(f.get("note") ?? ""), week });
                form.current?.reset();
              });
            }}
          >
            <label className="block min-w-0"><span className="label block mb-1">{type === "decision" ? "What was decided" : `New ${meta.verb}`}</span><input name="title" className="input py-1.5 w-full" required maxLength={200} /></label>
            <label className="block min-w-0"><span className="label block mb-1">{type === "decision" ? "Decided by" : "Owner"}</span><input name="owner" className="input py-1.5 w-full" maxLength={80} placeholder="one name" /></label>
            <label className="block"><span className="label block mb-1">{type === "decision" ? "Date" : "Due"}</span><input name="due" type="date" className="input py-1.5 w-full" defaultValue={type === "decision" ? today : ""} /></label>
            <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
            <label className="block md:col-span-4 min-w-0"><span className="label block mb-1">{type === "decision" ? "Why" : "Detail (optional)"}</span><input name="note" className="input py-1.5 w-full" maxLength={400} /></label>
          </form>
        )}
        {error && <p className="text-sm text-bad px-3 py-2">{error}</p>}
        {list.length === 0 ? (
          <p className="p-5 text-sm text-mute">{show === "open" ? `No open ${meta.label.toLowerCase()}.` : "Nothing here yet."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((it) => {
              const late = it.status === "open" && it.due != null && it.due < today && it.type !== "decision";
              const carried = it.status === "open" && it.week < week;
              return (
                <li key={it.id} className="p-3">
                  {editing === it.id ? (
                    <form
                      className="grid gap-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_150px_auto] items-end"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(async () => {
                          await updateWbrItem(it.id, { title: String(f.get("title")), owner: String(f.get("owner")), due: String(f.get("due")) || null, note: String(f.get("note")) });
                          setEditing(null);
                        });
                      }}
                    >
                      <input name="title" className="input py-1.5 w-full" defaultValue={it.title} required maxLength={200} aria-label="Title" />
                      <input name="owner" className="input py-1.5 w-full" defaultValue={it.owner} maxLength={80} aria-label="Owner" />
                      <input name="due" type="date" className="input py-1.5 w-full" defaultValue={it.due ?? ""} aria-label="Due" />
                      <div className="flex gap-1"><button className="btn btn-primary" disabled={pending}>Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div>
                      <input name="note" className="input py-1.5 w-full md:col-span-4" defaultValue={it.note} maxLength={400} aria-label="Detail" />
                    </form>
                  ) : (
                    <div className="flex items-start gap-3">
                      {it.type !== "decision" && (
                        <button
                          type="button"
                          disabled={!canEdit || pending}
                          aria-pressed={it.status === "done"}
                          aria-label={it.status === "done" ? "Reopen" : "Mark done"}
                          onClick={() => run(() => updateWbrItem(it.id, { status: it.status === "done" ? "open" : "done" }))}
                          className={`mt-0.5 grid place-items-center w-5 h-5 shrink-0 rounded border ${it.status === "done" ? "bg-gold border-gold text-bg" : "border-line hover:border-gold"}`}
                        >
                          {it.status === "done" && <Check size={13} />}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm break-words ${it.status === "open" ? "text-ink font-medium" : "text-mute line-through"}`}>{it.title}</div>
                        {it.note && <div className="text-sm text-dim break-words mt-0.5">{it.note}</div>}
                        <div className="text-xs text-mute mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
                          <span>{it.owner || (it.type === "decision" ? "" : "no owner")}</span>
                          {it.due && <span className={late ? "text-bad" : ""}>{it.type === "decision" ? day(it.due) : `due ${day(it.due)}`}{late ? " · late" : ""}</span>}
                          {carried && it.type !== "decision" && <span className="text-warn">carried from week of {day(it.week)}</span>}
                          {it.status === "parked" && <span>parked</span>}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          {it.type !== "decision" && it.type !== "task" && it.status === "open" && (
                            <>
                              <button type="button" className="btn btn-ghost text-xs" disabled={pending} title="Turn this into a task with an owner and a date" onClick={() => run(() => updateWbrItem(it.id, { type: "task" }))}>To task</button>
                              <button type="button" className="btn btn-ghost text-xs" disabled={pending} title="Deliberately set aside" onClick={() => run(() => updateWbrItem(it.id, { status: "parked" }))}>Park</button>
                            </>
                          )}
                          {it.status === "parked" && <button type="button" className="btn btn-ghost text-xs" disabled={pending} onClick={() => run(() => updateWbrItem(it.id, { status: "open" }))}>Reopen</button>}
                          <button type="button" className="text-mute hover:text-ink p-1" aria-label="Edit" onClick={() => setEditing(it.id)}><Pencil size={14} /></button>
                          <button type="button" className="text-mute hover:text-bad p-1" aria-label="Delete" disabled={pending} onClick={() => run(() => deleteWbrItem(it.id))}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- Run of show -----------------------------------------------------------

export function RunOfShow({ segments }: { segments: { min: number; name: string; desc: string }[] }) {
  const [at, setAt] = useState(-1); // segment index, -1 = not started
  const [left, setLeft] = useState(0); // seconds left in the segment; negative = over
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const go = (i: number) => {
    if (i >= segments.length) { setAt(-1); setRunning(false); setLeft(0); return; }
    setAt(i); setLeft(segments[i].min * 60); setRunning(true);
  };
  const mm = Math.floor(Math.abs(left) / 60), ss = String(Math.abs(left) % 60).padStart(2, "0");
  const total = segments.reduce((a, s) => a + s.min, 0);
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 border-b border-line">
        <div className={`text-3xl tabular-nums font-medium min-w-[5ch] ${left < 0 ? "text-bad" : "text-ink"}`} aria-live="off">{left < 0 ? "−" : ""}{mm}:{ss}</div>
        <div className="flex-1 min-w-40">
          <div className="label">{at < 0 ? "Not started" : `${at + 1} of ${segments.length}${left < 0 ? " · over time" : ""}`}</div>
          <div className="text-sm text-dim">{at < 0 ? `Start when everyone has joined. ${total} minutes in all.` : segments[at].name}</div>
        </div>
        {at < 0 ? <button type="button" className="btn btn-primary" onClick={() => go(0)}>Start</button> : (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Resume"}</button>
            <button type="button" className="btn btn-primary" onClick={() => go(at + 1)}>{at === segments.length - 1 ? "Finish" : "Next"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => go(segments.length)}>Reset</button>
          </>
        )}
      </div>
      <ol>
        {segments.map((s, i) => (
          <li key={s.name} className={`grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 px-4 py-3 border-t border-line first:border-t-0 ${i === at ? "bg-gold-dim" : ""}`}>
            <span className="text-xs tabular-nums text-mute pt-0.5">{s.min} min</span>
            <div><div className="text-sm font-medium text-ink">{s.name}</div><p className="text-sm text-dim">{s.desc}</p></div>
          </li>
        ))}
      </ol>
    </div>
  );
}
