import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getContext } from "@/lib/data";
import { kbHref } from "@/lib/kb";
import { PageHeader, Pill } from "@/components/ui";
import { STARTS } from "@/lib/roadmap";
import { loadRoadmap } from "@/lib/roadmap-load";
import { PhaseSkip, StartPicker, Step, type StepProps } from "./roadmap-client";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const { view, start, kbAvailable } = await loadRoadmap(ctx.db, t);
  const pct = view.total ? Math.round((view.done / view.total) * 100) : 0;
  const next = view.next;

  return (
    <>
      <PageHeader title="Roadmap" subtitle="The course and the tools, in the order you need them. Follow it top to bottom; skip what you have already done." />

      <section className="card p-4 mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="title text-base">{start ? "Where you started" : "First: where are you starting from?"}</h2>
          {start && <span className="text-xs text-mute">Change it any time. Phases you skipped can always be opened.</span>}
        </div>
        <StartPicker starts={STARTS} current={start} canEdit={ctx.canEdit} />
      </section>

      {start && (
        <>
          <section className="card p-4 mb-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="min-w-48">
                <div className="label mb-1">Progress</div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-40 rounded-full bg-elev overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-gold" style={{ width: `${pct}%` }} /></div>
                  <span className="text-sm tabular-nums text-ink">{view.done} of {view.total} steps</span>
                </div>
              </div>
              <div className="flex-1 min-w-60">
                <div className="label mb-1">Your next step</div>
                {next ? (
                  <a href={`#${next.phase.phase.id}`} className="text-sm text-ink font-medium hover:underline inline-flex items-center gap-1.5">{next.step.step.title} <ArrowRight size={14} className="text-gold" /></a>
                ) : <span className="text-sm text-good">Every step on your roadmap is done. Keep running the weekly review.</span>}
                {next && <div className="text-xs text-mute mt-0.5">Phase {next.phase.index}: {next.phase.phase.title}</div>}
              </div>
            </div>
            {!kbAvailable && <p className="text-xs text-warn mt-3">The Knowledge Base could not be reached, so lesson links are hidden for now. The steps and tools still work.</p>}
          </section>

          <div className="space-y-4">
            {view.phases.map((p) => {
              const isNextPhase = next?.phase.phase.id === p.phase.id;
              return (
                <section key={p.phase.id} id={p.phase.id} className={`card overflow-hidden scroll-mt-4 ${p.skipped ? "opacity-70" : ""}`}>
                  <details open={isNextPhase || (!p.skipped && !p.complete && !p.phase.parallel && !next)} className="group">
                    <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <span className={`grid place-items-center w-7 h-7 shrink-0 rounded-full text-xs font-semibold tabular-nums ${p.complete && !p.skipped ? "bg-good text-bg" : isNextPhase ? "bg-gold text-bg" : "bg-elev text-dim"}`}>{p.phase.parallel ? "+" : p.index}</span>
                      <div className="flex-1 min-w-48">
                        <div className="title text-base">{p.phase.title}</div>
                        <div className="text-xs text-mute">{p.phase.outcome}</div>
                      </div>
                      {p.skipped ? <Pill tone="mute">{p.behind ? "behind you" : "skipped"}</Pill> : p.complete ? <Pill tone="good">done</Pill> : <span className="text-xs tabular-nums text-dim">{p.done}/{p.total}</span>}
                    </summary>
                    <div className="border-t border-line">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-elev text-xs text-dim">
                        <span><span className="text-mute">Skip if: </span>{p.phase.skipIf}</span>
                        {!p.phase.parallel && <PhaseSkip phaseId={p.phase.id} skipped={p.skipped} canEdit={ctx.canEdit} />}
                      </div>
                      <ul>
                        {p.steps.map((s) => {
                          const props: StepProps = {
                            id: s.step.id, title: s.step.title, why: s.step.why, doneWhen: s.step.doneWhen, status: s.status, auto: s.auto, hasAuto: Boolean(s.step.auto), optional: Boolean(s.step.optional),
                            isNext: next?.step.step.id === s.step.id,
                            lessons: s.lessons.map((l) => ({ ...l, href: kbHref.lesson(l.id) })),
                            tool: s.step.tool ?? null, resource: s.step.resource ?? null,
                          };
                          return <Step key={s.step.id} s={props} canEdit={ctx.canEdit} phaseSkipped={p.skipped} />;
                        })}
                      </ul>
                    </div>
                  </details>
                </section>
              );
            })}
          </div>
          <p className="text-xs text-mute mt-5">Stuck on a step for more than a day? Put it on your <Link href="/wbr?tab=board" className="text-gold-soft hover:underline">Board</Link> as a need and bring it to your next call.</p>
        </>
      )}
    </>
  );
}
