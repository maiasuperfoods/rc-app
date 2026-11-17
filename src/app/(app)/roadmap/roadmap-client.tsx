"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import type { RoadmapStart } from "@/lib/types";
import { setPhaseSkipped, setRoadmapStart, setStepDone, setStepSkipped } from "./actions";

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => start(async () => { try { setError(null); await fn(); } catch (e) { setError((e as Error).message); } });
  return { pending, error, run };
}

export function StartPicker({ starts, current, canEdit }: { starts: { id: RoadmapStart; label: string; detail: string }[]; current: RoadmapStart | null; canEdit: boolean }) {
  const { pending, error, run } = useRun();
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {starts.map((s) => (
          <button key={s.id} type="button" disabled={!canEdit || pending} aria-pressed={current === s.id} onClick={() => run(() => setRoadmapStart(s.id))} className={`text-left rounded-lg border p-3 transition-colors ${current === s.id ? "border-gold bg-gold-dim" : "border-line hover:border-gold"} ${pending ? "opacity-60" : ""}`}>
            <div className="text-sm font-medium text-ink flex items-center gap-2">{current === s.id && <Check size={14} className="text-gold shrink-0" />}{s.label}</div>
            <div className="text-xs text-dim mt-1">{s.detail}</div>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-bad mt-2">{error}</p>}
    </div>
  );
}

export interface StepProps {
  id: string;
  title: string;
  why: string;
  doneWhen: string;
  status: "done" | "skipped" | "todo";
  auto: boolean;
  hasAuto: boolean;
  optional: boolean;
  isNext: boolean;
  lessons: { id: string; title: string; done: boolean; href: string }[];
  tool: { href: string; label: string } | null;
  resource: { href: string; label: string } | null;
}

export function Step({ s, canEdit, phaseSkipped }: { s: StepProps; canEdit: boolean; phaseSkipped: boolean }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(s.isNext);
  const done = s.status === "done";
  const skipped = s.status === "skipped";
  const read = s.lessons.filter((l) => l.done).length;
  return (
    <li className={`border-t border-line first:border-t-0 ${s.isNext ? "bg-gold-dim" : ""}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          disabled={!canEdit || pending || s.auto}
          aria-pressed={done}
          aria-label={done ? "Mark as not done" : "Mark as done"}
          title={s.auto ? "Ticked from your data" : s.hasAuto ? "Ticks itself when the app sees it; tick it yourself if you did this elsewhere" : undefined}
          onClick={() => run(() => setStepDone(s.id, !done))}
          className={`mt-0.5 grid place-items-center w-5 h-5 shrink-0 rounded-full border ${done ? "bg-good border-good text-bg" : "border-line hover:border-gold"} ${s.auto ? "cursor-default" : ""}`}
        >
          {done && <Check size={12} />}
        </button>
        <button type="button" className="flex-1 min-w-0 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <div className={`text-sm ${done ? "text-dim" : skipped ? "text-mute" : "text-ink font-medium"}`}>
            {s.title}
            {s.isNext && <span className="ml-2 text-[10px] uppercase tracking-wider font-semibold text-gold align-middle">next</span>}
            {s.optional && !done && <span className="ml-2 text-[10px] uppercase tracking-wider text-mute align-middle">optional</span>}
            {skipped && !phaseSkipped && <span className="ml-2 text-[10px] uppercase tracking-wider text-mute align-middle">skipped</span>}
          </div>
          <div className="text-xs text-mute mt-0.5">{s.why}</div>
        </button>
        <div className="flex items-center gap-2 shrink-0 text-xs text-mute">
          {s.lessons.length > 0 && <span className="tabular-nums hidden sm:inline">{read}/{s.lessons.length} read</span>}
          <button type="button" aria-label={open ? "Hide detail" : "Show detail"} onClick={() => setOpen((o) => !o)} className="p-1 hover:text-ink"><ChevronDown size={15} className={open ? "rotate-180" : ""} /></button>
        </div>
      </div>
      {open && (
        <div className="pl-12 pr-4 pb-4 space-y-3">
          {s.lessons.length > 0 && (
            <div>
              <div className="label mb-1.5">{s.lessons.length === 1 ? "Read" : "Read, in this order"}</div>
              <ol className="space-y-1">
                {s.lessons.map((l, i) => (
                  <li key={l.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-xs tabular-nums text-mute w-4 shrink-0">{l.done ? <Check size={12} className="text-good inline" /> : i + 1}</span>
                    <Link href={l.href} className={`hover:underline ${l.done ? "text-dim" : "text-gold-soft"}`}>{l.title}</Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {(s.tool || s.resource) && (
            <div className="flex flex-wrap gap-2">
              {s.tool && <Link href={s.tool.href} className="btn btn-primary">Open {s.tool.label} <ArrowRight size={14} /></Link>}
              {s.resource && <Link href={s.resource.href} className="btn btn-secondary">{s.resource.label}</Link>}
            </div>
          )}
          <p className="text-xs text-dim"><span className="text-mute">Done when: </span>{s.doneWhen}{s.hasAuto && !done && <span className="text-mute"> This ticks itself.</span>}</p>
          {canEdit && !done && !phaseSkipped && (
            <button type="button" disabled={pending} className="text-xs text-mute hover:text-ink underline underline-offset-2" onClick={() => run(() => setStepSkipped(s.id, !skipped))}>
              {skipped ? "Bring this step back" : "This doesn't apply to me — skip it"}
            </button>
          )}
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      )}
    </li>
  );
}

export function PhaseSkip({ phaseId, skipped, canEdit }: { phaseId: string; skipped: boolean; canEdit: boolean }) {
  const { pending, error, run } = useRun();
  if (!canEdit) return null;
  return (
    <>
      <button type="button" disabled={pending} className="btn btn-ghost text-xs" onClick={() => run(() => setPhaseSkipped(phaseId, !skipped))}>
        {skipped ? "Open this phase" : "Skip this phase"}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </>
  );
}
