import { getContext } from "@/lib/data";
import { pcConfigured } from "@/lib/pc/client";
import { bundle } from "@/lib/pc/queries";
import { metricMeta } from "@/lib/pc/ai";
import { num } from "@/lib/pc/types";
import { Card, Empty, PageHeader, Pill } from "@/components/ui";
import { fmtD, fmtDT, fmtFor, money } from "@/components/coaching/format";
import { MyItemToggle } from "./items";

export const dynamic = "force-dynamic";
const nowMs = () => Date.now();

/** The student's view of their coaching program: goal, numbers, initiatives, commitments, call notes. */
export default async function CoachingPage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  if (ctx.demo || !pcConfigured() || !t.pcStudentId) {
    return (
      <>
        <PageHeader title="Coaching" subtitle="Your Private Circle progress: 90-day goal, weekly calls, commitments and initiatives." />
        <Empty title={ctx.demo ? "Coaching is not part of the demo brand" : "Not connected to the Private Circle yet"} body={ctx.demo ? "Real brands created from the Private Circle show their goal, call notes, commitments and initiatives here." : "Once your brand is linked to your Private Circle record, your goal, call notes and commitments appear here. Ask your coach if you expected to see them."} />
      </>
    );
  }
  const b = await bundle(t.pcStudentId);
  if (!b) return <><PageHeader title="Coaching" /><Empty title="No coaching record found" body="Ask your coach to check the link between your brand and your Private Circle profile." /></>;
  const { student: s, calls, actions, metrics, initiatives } = b;
  const a = b.intake?.answers ?? {};
  const now = nowMs();
  const nowDate = new Date(now);
  const series = (k: string) => metrics.filter((x) => x.metric === k);
  const latest = (k: string) => series(k).at(-1) ?? null;
  const goal = num(a.goal_90d); const cur = latest("revenue_30d"); const first = series("revenue_30d")[0];
  const progress = goal && cur ? Math.min(100, Math.round((cur.value / goal) * 100)) : null;
  const sinceStart = first && cur && first.id !== cur.id ? cur.value - first.value : null;
  const joined = s.paid_at || s.agreement_signed_at; const weeks = joined ? Math.max(0, Math.floor((now - +new Date(joined)) / (7 * 86400e3))) : null;
  const completed = calls.filter((c) => c.status === "completed");
  const nextCall = calls.filter((c) => c.status === "scheduled" && c.scheduled_at && +new Date(c.scheduled_at) > now).sort((x, y) => +new Date(x.scheduled_at!) - +new Date(y.scheduled_at!))[0];
  const mine = actions.filter((x) => x.owner === "student" && x.status !== "dropped");
  const openMine = mine.filter((x) => x.status === "open");
  // Overdue first, then soonest due, then undated; anything closed drops to the bottom.
  const due = (x: { due_on: string | null }) => (x.due_on ? +new Date(x.due_on) : Number.MAX_SAFE_INTEGER);
  const sortedMine = [...mine].sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || due(a) - due(b) || +new Date(a.created_at) - +new Date(b.created_at));
  const callDate = new Map(calls.map((c) => [c.id, c.ended_at || c.scheduled_at || c.created_at]));
  const theirs = actions.filter((x) => x.owner === "founder" && x.status === "open");
  const meta = (k: string) => metricMeta(k, metrics.find((x) => x.metric === k));
  const tile = (k: string) => { const pts = series(k); const last = pts.at(-1), prev = pts.at(-2); const { label, unit } = meta(k); const f = fmtFor(unit); const up = last && prev ? last.value >= prev.value : null;
    return <div key={k} className="card p-4"><div className="text-2xl font-medium text-gold-soft tabular-nums">{f(last?.value ?? null)}</div><div className="label mt-1">{label}{last ? ` · ${fmtD(last.as_of)}` : ""}</div>{prev && last && <div className={`text-xs mt-1 ${up ? "text-good" : "text-bad"}`}>{up ? "▲" : "▼"} {f(Math.abs(last.value - prev.value))} vs {fmtD(prev.as_of)}</div>}</div>; };
  const cols: [string, string][] = [["planned", "Planned"], ["in_progress", "In progress"], ["done", "Done"], ["parked", "Parked"]];
  const canEdit = ctx.canEdit && !ctx.isCoach;

  return (
    <>
      <PageHeader title="Coaching" subtitle={<span className="flex items-center gap-2 flex-wrap"><span>Private Circle · {s.lead_founder ? `lead coach ${s.lead_founder}` : "your coaches"}</span>{s.booking_url && <a className="text-gold-soft" href={s.booking_url} target="_blank" rel="noreferrer">Book a call →</a>}</span>} />
      <div className="grid lg:grid-cols-3 gap-3 mb-4">
        <Card title="90-day goal">{goal ? <><div className="text-2xl font-medium text-gold-soft tabular-nums">{cur ? money(cur.value) : "—"} <span className="text-sm text-mute font-normal">of {money(goal)}/mo</span></div><div className="h-1.5 bg-line rounded-full my-2.5"><div className="h-1.5 bg-gold rounded-full" style={{ width: `${progress ?? 0}%` }} /></div><div className="text-xs text-mute">{progress ?? 0}%{sinceStart !== null && ` · ${sinceStart >= 0 ? "+" : "−"}${money(Math.abs(sinceStart))} since joining`}{weeks !== null && ` · week ${weeks + 1}`}</div></> : <p className="text-sm text-mute">Your 90-day target comes from the intake.</p>}</Card>
        <Card title="Calls"><div className="text-2xl font-medium text-gold-soft tabular-nums">{completed.length} <span className="text-sm text-mute font-normal">completed{weeks ? ` in ${weeks} wk` : ""}</span></div><div className="text-xs text-mute mt-1">{nextCall ? <>next {fmtDT(nextCall.scheduled_at)}{nextCall.meeting_url && <> · <a className="text-gold-soft" href={nextCall.meeting_url} target="_blank" rel="noreferrer">join</a></>}</> : "none booked"}</div></Card>
        <Card title="Your commitments"><div className="text-2xl font-medium text-gold-soft tabular-nums">{mine.filter((x) => x.status === "done").length}/{mine.filter((x) => x.status !== "dropped").length} <span className="text-sm text-mute font-normal">done</span></div><div className="text-xs text-mute mt-1">{mine.filter((x) => x.status === "open" && x.due_on && +new Date(x.due_on) < now).length} overdue · {theirs.length} the RC team owes you</div></Card>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">{["revenue_30d", "ad_spend_30d", "net_margin_pct", "cac"].map(tile)}</div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title={`Your action items${openMine.length ? ` (${openMine.length} open)` : ""}`} hint="What you committed to on your calls. Tick them off as you go.">
          {mine.length ? (
            <ul className="divide-y divide-line">
              {sortedMine.map((x) => {
                const overdue = x.status === "open" && x.due_on && new Date(x.due_on) < nowDate;
                const from = x.source_call_id ? callDate.get(x.source_call_id) : null;
                return (
                  <li key={x.id} className={`py-2.5 flex items-start gap-3 text-sm ${x.status !== "open" ? "opacity-50" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className={x.status === "done" ? "line-through" : "text-ink"}>{x.text}</div>
                      <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {overdue && <Pill tone="bad">overdue</Pill>}
                        {x.due_on && <span className={overdue ? "text-bad" : "text-mute"}>due {fmtD(x.due_on)}</span>}
                        {from && <span className="text-mute">{x.due_on ? "· " : ""}from your {fmtD(from)} call</span>}
                      </div>
                    </div>
                    <MyItemToggle id={x.id} status={x.status} canEdit={canEdit} />
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-mute">Nothing yet. What you agree to on a call shows up here within minutes of it ending.</p>}
        </Card>
        <Card title="What the RC team owes you">
          {theirs.length ? <ul className="space-y-2 text-sm">{theirs.map((x) => <li key={x.id} className="flex gap-2"><Pill tone="gold">RC team</Pill><span className="text-ink">{x.text}{x.due_on && <span className="text-mute"> · due {fmtD(x.due_on)}</span>}</span></li>)}</ul> : <p className="text-sm text-mute">Nothing open.</p>}
        </Card>
      </div>

      <Card title="Initiatives" hint="The levers you and your coaches are working on." className="mb-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cols.map(([k, l]) => (
            <div key={k}>
              <div className="label mb-2">{l} <span className="text-mute">{initiatives.filter((i) => i.status === k).length}</span></div>
              {initiatives.filter((i) => i.status === k).map((i) => <div key={i.id} className="card-elev p-3 mb-2"><b className="text-sm font-medium text-ink">{i.name}</b>{i.last_update && <p className="text-xs text-dim mt-1.5">{i.last_update}</p>}<p className="text-[11px] text-mute mt-1.5">updated {fmtD(i.updated_at)}</p></div>)}
              {!initiatives.some((i) => i.status === k) && <p className="text-xs text-mute">—</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Call notes">
        {completed.length ? completed.map((c) => (
          <div key={c.id} className="grid grid-cols-[110px_1fr] gap-4 py-4 border-b border-line last:border-0">
            <div><b className="text-sm font-medium text-ink">{fmtD(c.ended_at || c.scheduled_at)}</b><div className="text-xs text-mute">{c.kind}{c.recording_url && <> · <a className="text-gold-soft" href={c.recording_url} target="_blank" rel="noreferrer">recording</a></>}</div></div>
            <div className="text-sm space-y-1.5 min-w-0">
              {c.what_changed && <p className="text-ink"><b className="font-medium">What changed:</b> {c.what_changed}</p>}
              {c.summary ? <p className="text-dim whitespace-pre-wrap">{c.summary}</p> : <p className="text-mute text-xs">Notes are being prepared.</p>}
              {!!c.decisions?.length && <p className="text-xs"><Pill tone="gold">decisions</Pill> <span className="text-dim">{c.decisions.join(" · ")}</span></p>}
            </div>
          </div>
        )) : <p className="text-sm text-mute">Your first call&apos;s notes will appear here after the call.</p>}
      </Card>
    </>
  );
}
