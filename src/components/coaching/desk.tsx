import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Pill } from "@/components/ui";
import { INTAKE_SECTIONS, intakeValue } from "@/lib/pc/intake";
import { metricMeta } from "@/lib/pc/ai";
import { PC_BASE, pcSignedUrl } from "@/lib/pc/client";
import { num, type PcMetric, type StudentBundle } from "@/lib/pc/types";
import { fmtD, fmtDT, fmtFor, money, pct, srcLabel } from "./format";
import { ActionItemRow, AddActionItem, AddCallForm, AddInitiative, AgendaButton, CallRow, CheckinButton, CopyLink, InitiativeStatus, LogNumbers, ProfileForm, ResetIntake } from "./desk-client";

export type DeskTab = "overview" | "progress" | "calls" | "actions" | "intake" | "files" | "profile" | "platform";

export const statusTone = (s: string) => (s === "active" ? "good" : s === "signed" ? "warn" : s === "cancelled" ? "bad" : "mute") as "good" | "warn" | "bad" | "mute";
export const intakeLabel = (s: string) => (s === "complete" ? "intake done" : s === "in_progress" ? "intake started" : "no intake");
export const intakeTone = (s: string) => (s === "complete" ? "good" : s === "in_progress" ? "warn" : "mute") as "good" | "warn" | "mute";

/** Header line used by both the brand page and the pre-provision student page. */
export function StudentHeading({ b }: { b: StudentBundle }) {
  const s = b.student;
  return (
    <span className="flex items-center gap-2 flex-wrap">
      <Pill tone={statusTone(s.status)}>{s.status}</Pill>
      <Pill tone={intakeTone(s.intake_status)}>{intakeLabel(s.intake_status)}</Pill>
      <span>· joined {fmtD(s.paid_at || s.agreement_signed_at || s.created_at)}</span>
      <span>· {s.lead_founder ? `lead: ${s.lead_founder}` : "no lead coach"}</span>
      {s.company_name && <span>· {s.company_name}</span>}
    </span>
  );
}

export function DeskTabs({ base, tab, b, extra }: { base: string; tab: DeskTab; b: StudentBundle; extra?: { key: DeskTab; label: string }[] }) {
  const open = b.actions.filter((x) => x.status === "open").length;
  const tabs: { key: DeskTab; label: string }[] = [
    { key: "overview", label: "Starting Point" },
    { key: "progress", label: "Progress" },
    { key: "calls", label: `Calls (${b.calls.length})` },
    { key: "actions", label: `Action items (${open})` },
    { key: "intake", label: "Intake" },
    { key: "files", label: `Files (${b.files.length + (b.agreementUrl ? 1 : 0)})` },
    { key: "profile", label: "Profile" },
    ...(extra ?? []),
  ];
  return (
    <div className="flex gap-1 border-b border-line mb-5 flex-wrap">
      {tabs.map((t) => (
        <Link key={t.key} href={`${base}?tab=${t.key}`} className={`px-3.5 py-2.5 text-sm -mb-px border-b-2 ${tab === t.key ? "border-gold text-gold-soft" : "border-transparent text-dim hover:text-ink"}`}>{t.label}</Link>
      ))}
    </div>
  );
}

const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-1.5 text-sm">
    {rows.map(([k, v]) => (
      <div key={k} className="contents"><dt className="text-mute">{k}</dt><dd className="text-ink break-words">{v}</dd></div>
    ))}
  </dl>
);

const nowMs = () => Date.now();

export async function DeskContent({ b, tab, children }: { b: StudentBundle; tab: DeskTab; children?: ReactNode }) {
  const { student: s, calls, actions, metrics, initiatives, checkins, files, intake } = b;
  const a = intake?.answers ?? {};
  const now = nowMs();
  const openActs = actions.filter((x) => x.status === "open");
  const latest = (metric: string): PcMetric | null => { const m = metrics.filter((x) => x.metric === metric); return m.length ? m[m.length - 1] : null; };
  const series = (k: string) => metrics.filter((x) => x.metric === k);
  const nextCall = calls.filter((c) => c.status === "scheduled" && c.scheduled_at && +new Date(c.scheduled_at) > now).sort((x, y) => +new Date(x.scheduled_at!) - +new Date(y.scheduled_at!))[0];
  const completed = calls.filter((c) => c.status === "completed");
  const lastCall = completed[0];
  const intakeUrl = `${PC_BASE()}/intake/${s.intake_token}`;

  if (tab === "platform") return <>{children}</>;

  if (tab === "overview") {
    const stat = (label: string, m: string, fmt: (v: number | null) => string = money) => { const x = latest(m); return <div key={m} className="card p-4"><div className="text-2xl font-medium text-gold-soft tabular-nums">{fmt(x?.value ?? null)}</div><div className="label mt-1">{label}{x ? ` · ${fmtD(x.as_of)}` : ""}</div></div>; };
    const storeUrl = String(a.store_url ?? "");
    const href = /^https?:/.test(storeUrl) ? storeUrl : storeUrl ? `https://${storeUrl}` : null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stat("Revenue / 30d", "revenue_30d")}{stat("Ad spend / 30d", "ad_spend_30d")}{stat("Gross margin", "gross_margin_pct", pct)}{stat("Net margin", "net_margin_pct", pct)}
          {stat("AOV", "aov")}{stat("CAC", "cac")}{stat("Cash on hand", "cash_on_hand")}{stat("Runway (months)", "runway_months", (v) => (v == null ? "—" : String(v)))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Business">
            <KV rows={[
              ["Brand", <>{intakeValue(a.brand_name)}{href && <> · <a className="text-gold-soft" href={href} target="_blank" rel="noreferrer">{storeUrl}</a></>}</>],
              ["Niche", `${intakeValue(a.niche)} · since ${intakeValue(a.year_started)} · ${intakeValue(a.sku_count)} SKUs · ${intakeValue(a.platform)}`],
              ["Markets", intakeValue(a.markets)],
              ["Hero products", intakeValue(a.hero_products)],
              ["Channels", `${intakeValue(a.channels)}${a.spend_split ? ` — ${a.spend_split}` : ""}`],
              ["Landing pages", intakeValue(a.landing_pages)],
              ["Best offer", intakeValue(a.best_offer)],
            ]} />
          </Card>
          <Card title="Goals & blockers">
            <KV rows={[
              ["90-day target", num(a.goal_90d) ? `${money(num(a.goal_90d))}/mo` : "—"],
              ["12-month target", num(a.goal_12m) ? `${money(num(a.goal_12m))}/mo` : "—"],
              ["Bottleneck", intakeValue(a.bottleneck)],
              ["Already tried", intakeValue(a.tried)],
              ["Wants from the Circle", intakeValue(a.want_from_circle)],
              ["Team", <>{intakeValue(a.team)}{a.team_other ? <div className="text-mute text-xs">{String(a.team_other)}</div> : null}</>],
              ["Founder hours / wk", `${intakeValue(a.founder_hours)}${a.offload ? ` · wants off plate: ${a.offload}` : ""}`],
            ]} />
          </Card>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Calls">
            <p className="text-sm"><b className="font-medium text-ink">Next:</b> <span className="text-dim">{nextCall ? <>{fmtDT(nextCall.scheduled_at)}{nextCall.meeting_url && <> · <a className="text-gold-soft" href={nextCall.meeting_url} target="_blank" rel="noreferrer">join</a></>}</> : "none booked"}</span></p>
            <p className="text-sm mb-2"><b className="font-medium text-ink">Last:</b> <span className="text-dim">{lastCall ? fmtDT(lastCall.ended_at || lastCall.scheduled_at) : "—"}</span></p>
            {lastCall?.summary && <p className="text-sm text-dim whitespace-pre-wrap">{lastCall.summary}</p>}
            <Link href="?tab=calls" className="text-sm text-gold-soft mt-2 inline-block">All calls →</Link>
          </Card>
          <Card title={`Open action items (${openActs.length})`}>
            {openActs.length ? <ul className="space-y-1.5 text-sm">{openActs.slice(0, 8).map((x) => <li key={x.id} className="flex gap-2"><Pill tone="mute">{x.owner === "founder" ? "RC Team" : "Student"}</Pill><span className="text-ink">{x.text}{x.due_on && <span className="text-mute"> · due {fmtD(x.due_on)}</span>}</span></li>)}</ul> : <p className="text-sm text-mute">None.</p>}
            <Link href="?tab=actions" className="text-sm text-gold-soft mt-2 inline-block">Manage →</Link>
          </Card>
        </div>
        {s.intake_status !== "complete" && (
          <Card className="border-warn/40">
            <div className="flex flex-wrap items-center gap-3 text-sm"><b className="text-ink font-medium">Intake {s.intake_status === "in_progress" ? "in progress" : "not started"}.</b><code className="text-xs text-dim break-all">{intakeUrl}</code><CopyLink url={intakeUrl} /></div>
          </Card>
        )}
      </div>
    );
  }

  if (tab === "progress") {
    const keys = [...new Set(metrics.map((m) => m.metric))];
    const meta = (k: string) => { const m = metrics.find((x) => x.metric === k); return metricMeta(k, m); };
    const goal = num(a.goal_90d); const cur = latest("revenue_30d"); const first = series("revenue_30d")[0];
    const progress = goal && cur ? Math.min(100, Math.round((cur.value / goal) * 100)) : null;
    const sinceStart = first && cur && first.id !== cur.id ? cur.value - first.value : null;
    const joined = s.paid_at || s.agreement_signed_at; const weeks = joined ? Math.max(0, Math.floor((now - +new Date(joined)) / (7 * 86400e3))) : null;
    const overdue = openActs.filter((x) => x.due_on && +new Date(x.due_on) < now);
    const stale = initiatives.filter((i) => i.status === "in_progress" && now - +new Date(i.updated_at) > 14 * 86400e3);
    const lastProcessed = completed.find((c) => c.processed_at);
    const prep = [
      ...overdue.map((x) => ({ tone: "bad" as const, tag: "overdue", text: `[${x.owner === "founder" ? "RC Team" : "Student"}] ${x.text} · due ${fmtD(x.due_on)}` })),
      ...(lastProcessed?.open_questions ?? []).map((q) => ({ tone: "gold" as const, tag: "ask", text: q })),
      ...(lastProcessed?.blockers ?? []).map((q) => ({ tone: "warn" as const, tag: "blocker", text: q })),
      ...stale.map((i) => ({ tone: "mute" as const, tag: "no update 2w+", text: i.name })),
      ...openActs.filter((x) => x.owner === "founder" && !(x.due_on && +new Date(x.due_on) < now)).map((x) => ({ tone: "mute" as const, tag: "RC team owes", text: x.text })),
    ];
    const tile = (k: string) => { const pts = series(k); const last = pts.at(-1), prev = pts.at(-2); const { label, unit } = meta(k); const f = fmtFor(unit); const up = last && prev ? last.value >= prev.value : null;
      return <div key={k} className="card p-4"><div className="text-2xl font-medium text-gold-soft tabular-nums">{f(last?.value ?? null)}</div><div className="label mt-1">{label}{last ? ` · ${fmtD(last.as_of)}` : ""}</div>{prev && last && <div className={`text-xs mt-1 ${up ? "text-good" : "text-bad"}`}>{up ? "▲" : "▼"} {f(Math.abs(last.value - prev.value))} vs {fmtD(prev.as_of)}</div>}</div>; };
    const cols: [string, string][] = [["planned", "Planned"], ["in_progress", "In progress"], ["done", "Done"], ["parked", "Parked"]];
    const dates = [...new Set(metrics.map((x) => x.as_of))].sort();
    const lastCheckin = checkins.find((c) => c.submitted_at);
    const line = (k: string) => { const pts = series(k); const { unit } = meta(k); const f = fmtFor(unit);
      if (pts.length < 2) return <span className="text-xs text-mute">{pts.length ? `${f(pts[0].value)} · ${fmtD(pts[0].as_of)} · ${srcLabel(pts[0].source)}` : "no data yet"}</span>;
      const vals = pts.map((x) => x.value); const lo = Math.min(...vals), hi = Math.max(...vals), W = 200, H = 36; const y = (v: number) => (hi === lo ? H / 2 : H - 4 - ((v - lo) / (hi - lo)) * (H - 8));
      const d = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${y(v)}`).join(" "); const last = vals.at(-1)!, prev = vals.at(-2)!; const up = last >= prev;
      return <span className="flex items-center gap-3"><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="overflow-visible shrink-0"><polyline points={d} fill="none" stroke="var(--gold)" strokeWidth="1.5" />{pts.map((p, i) => <circle key={p.id} cx={(i / (vals.length - 1)) * W} cy={y(p.value)} r="2.5" fill="var(--gold)"><title>{`${fmtD(p.as_of)}: ${f(p.value)} (${srcLabel(p.source)})${p.quote ? ` — “${p.quote}”` : ""}`}</title></circle>)}</svg><span className="text-sm tabular-nums"><b className="font-medium text-ink">{f(last)}</b> <span className={`text-xs ${up ? "text-good" : "text-bad"}`}>{up ? "▲" : "▼"} {f(Math.abs(last - prev))}</span></span></span>; };
    return (
      <div className="space-y-4">
        <div className="grid lg:grid-cols-3 gap-3">
          <Card title="90-day goal">{goal ? <><div className="text-2xl font-medium text-gold-soft tabular-nums">{cur ? money(cur.value) : "—"} <span className="text-sm text-mute font-normal">of {money(goal)}/mo</span></div><div className="h-1.5 bg-line rounded-full my-2.5"><div className="h-1.5 bg-gold rounded-full" style={{ width: `${progress ?? 0}%` }} /></div><div className="text-xs text-mute">{progress ?? 0}%{sinceStart !== null && ` · ${sinceStart >= 0 ? "+" : "−"}${money(Math.abs(sinceStart))} since joining`}{weeks !== null && ` · week ${weeks + 1}`}</div></> : <p className="text-sm text-mute">No 90-day target in the intake yet.</p>}</Card>
          <Card title="Calls"><div className="text-2xl font-medium text-gold-soft tabular-nums">{completed.length} <span className="text-sm text-mute font-normal">completed{weeks ? ` in ${weeks} wk` : ""}</span></div><div className="text-xs text-mute mt-1">{nextCall ? `next ${fmtDT(nextCall.scheduled_at)}` : "none booked"}{lastCall && ` · last ${fmtD(lastCall.ended_at || lastCall.scheduled_at)}`}</div></Card>
          <Card title="Commitments"><div className="text-2xl font-medium text-gold-soft tabular-nums">{actions.filter((x) => x.status === "done").length}/{actions.filter((x) => x.status !== "dropped").length} <span className="text-sm text-mute font-normal">done</span></div><div className="text-xs text-mute mt-1">{overdue.length} overdue · {openActs.filter((x) => x.owner === "student").length} on the student, {openActs.filter((x) => x.owner === "founder").length} on the RC team</div></Card>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{["revenue_30d", "ad_spend_30d", "net_margin_pct", "cac"].map(tile)}</div>
        <Card className="border-gold/40" title={<>Pre-call prep{nextCall && <span className="text-mute font-normal normal-case tracking-normal"> · next call {fmtDT(nextCall.scheduled_at)}</span>}</>} actions={<AgendaButton studentId={s.id} />}>
          {prep.length ? <ul className="space-y-1.5 text-sm">{prep.map((p, i) => <li key={i} className="flex gap-2 items-start"><Pill tone={p.tone}>{p.tag}</Pill><span className="text-ink">{p.text}</span></li>)}</ul> : <p className="text-sm text-mute">Nothing outstanding.</p>}
        </Card>
        <Card title="Initiatives" actions={<AddInitiative studentId={s.id} />}>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cols.map(([k, l]) => (
              <div key={k}>
                <div className="label mb-2">{l} <span className="text-mute">{initiatives.filter((i) => i.status === k).length}</span></div>
                {initiatives.filter((i) => i.status === k).map((i) => (
                  <div key={i.id} className="card-elev p-3 mb-2">
                    <div className="flex justify-between gap-2 items-start"><b className="text-sm font-medium text-ink">{i.name}</b><InitiativeStatus initiative={i} /></div>
                    {i.last_update && <p className="text-xs text-dim mt-1.5">{i.last_update}</p>}
                    <p className="text-[11px] text-mute mt-1.5">{i.target_metric ? `moves ${meta(i.target_metric).label} · ` : ""}updated {fmtD(i.updated_at)}</p>
                  </div>
                )) }
                {!initiatives.some((i) => i.status === k) && <p className="text-xs text-mute">—</p>}
              </div>
            ))}
          </div>
          {!initiatives.length && <p className="text-xs text-mute mt-2">Initiatives are created automatically from calls (the levers being worked on), or add one by hand.</p>}
        </Card>
        <Card title="Trends" actions={<LogNumbers studentId={s.id} />}>
          <div className="grid md:grid-cols-2 gap-x-8">{keys.map((k) => <div key={k} className="flex items-center gap-3 py-2 border-b border-line"><span className="w-36 shrink-0 text-xs text-dim">{meta(k).label}</span>{line(k)}</div>)}{!keys.length && <p className="text-sm text-mute">No numbers yet. They arrive from the intake, from figures stated on calls, from monthly check-ins, or via Log numbers.</p>}</div>
        </Card>
        {dates.length > 0 && (
          <Card title="All values by date" hint="Hover a value for its source and the quote behind it.">
            <div className="overflow-x-auto"><table className="table"><thead><tr><th>Metric</th>{dates.map((d) => <th key={d} className="num">{fmtD(d)}</th>)}</tr></thead><tbody>
              {keys.map((k) => <tr key={k}><td>{meta(k).label}</td>{dates.map((d) => { const x = series(k).filter((y) => y.as_of === d).at(-1); return <td key={d} className="num" title={x ? `${srcLabel(x.source)}${x.quote ? ` — ${x.quote}` : ""}` : ""}>{x ? fmtFor(meta(k).unit)(x.value) : <span className="text-mute">·</span>}</td>; })}</tr>)}
            </tbody></table></div>
          </Card>
        )}
        <Card title="Monthly check-in" actions={<CheckinButton studentId={s.id} />}>
          <p className="text-sm text-dim">{lastCheckin ? `Last submitted ${fmtD(lastCheckin.submitted_at)}.` : "No check-in submitted yet."} A check-in asks the student for the Numbers section only (2 minutes) and adds a dated column above.</p>
        </Card>
        <Card title="Timeline">
          {completed.length ? completed.map((c) => { const items = actions.filter((x) => x.source_call_id === c.id); const nums = metrics.filter((x) => x.call_id === c.id || x.source === `call:${c.id}`); const inits = initiatives.filter((i) => i.last_call_id === c.id || i.started_call_id === c.id);
            return (
              <div key={c.id} className="grid grid-cols-[110px_1fr] gap-4 py-4 border-b border-line last:border-0">
                <div><b className="text-sm font-medium text-ink">{fmtD(c.ended_at || c.scheduled_at)}</b><div className="text-xs text-mute">{c.kind}{c.recording_url && <> · <a className="text-gold-soft" href={c.recording_url} target="_blank" rel="noreferrer">rec</a></>}</div></div>
                <div className="text-sm space-y-1.5 min-w-0">
                  {c.what_changed && <p className="text-ink"><b className="font-medium">What changed:</b> {c.what_changed}</p>}
                  {c.summary ? <p className="text-dim whitespace-pre-wrap">{c.summary}</p> : c.transcript ? <p className="text-mute text-xs">Processing…</p> : <p className="text-mute text-xs">No transcript.</p>}
                  {!!c.decisions?.length && <p className="text-xs"><Pill tone="gold">decisions</Pill> <span className="text-dim">{c.decisions.join(" · ")}</span></p>}
                  {nums.length > 0 && <p className="text-xs"><Pill tone="gold">numbers</Pill> <span className="text-dim">{nums.map((n) => `${meta(n.metric).label}: ${fmtFor(meta(n.metric).unit)(n.value)}`).join(" · ")}</span></p>}
                  {inits.length > 0 && <p className="text-xs"><Pill tone="gold">initiatives</Pill> <span className="text-dim">{inits.map((i) => `${i.name} → ${i.status.replace("_", " ")}`).join(" · ")}</span></p>}
                  {!!c.blockers?.length && <p className="text-xs"><Pill tone="warn">blockers</Pill> <span className="text-dim">{c.blockers.join(" · ")}</span></p>}
                  {items.length > 0 && <ul className="space-y-1">{items.map((x) => <li key={x.id} className={`flex gap-2 ${x.status !== "open" ? "opacity-50 line-through" : ""}`}><Pill tone="mute">{x.owner === "founder" ? "RC Team" : "Student"}</Pill><span>{x.text}</span></li>)}</ul>}
                </div>
              </div>
            ); }) : <p className="text-sm text-mute">No completed calls yet. Each call appears here with what changed, the numbers stated, decisions, initiatives moved and commitments made.</p>}
        </Card>
      </div>
    );
  }

  if (tab === "calls") {
    return (
      <div className="space-y-4">
        <Card>{calls.length ? calls.map((c) => <CallRow key={c.id} call={c} />) : <p className="text-sm text-mute">No calls yet. Bookings from Cal.com and transcripts from the recorder will appear here.</p>}</Card>
        <Card title="Add a call manually" hint="Paste a transcript (from a Google Meet transcript doc or a recorder export).">
          <AddCallForm students={[]} defaultStudentId={s.id} />
        </Card>
      </div>
    );
  }

  if (tab === "actions") {
    const group = (owner: "student" | "founder") => { const items = actions.filter((x) => x.owner === owner); const open = items.filter((x) => x.status === "open");
      return (
        <Card key={owner} title={<>{owner === "founder" ? "Renaissance Commerce Team" : "Student"} <span className="text-mute font-normal">· {open.length} open{items.length - open.length ? `, ${items.length - open.length} closed` : ""}</span></>}>
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>Item</th><th className="num">Due</th><th>Status</th><th /></tr></thead><tbody>
            {[...open, ...items.filter((x) => x.status !== "open")].map((x) => <ActionItemRow key={x.id} item={x} />)}
            {!items.length && <tr><td colSpan={4} className="text-mute">Nothing here yet.</td></tr>}
          </tbody></table></div>
        </Card>
      ); };
    return <div className="space-y-4">{group("student")}{group("founder")}<Card title="Add an item"><AddActionItem studentId={s.id} /></Card></div>;
  }

  if (tab === "intake") {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-3 text-sm text-dim mb-4">
          <span>Status:</span><Pill tone={intakeTone(s.intake_status)}>{intakeLabel(s.intake_status)}</Pill>
          {intake?.updated_at && <span>· last saved {fmtDT(intake.updated_at)}</span>}
          <span>· link:</span><code className="text-xs break-all">{intakeUrl}</code><CopyLink url={intakeUrl} />
          <span className="ml-auto"><ResetIntake studentId={s.id} /></span>
        </div>
        {INTAKE_SECTIONS.map((sec) => (
          <div key={sec.id} className="mb-5"><div className="label mb-2">{sec.title}</div><KV rows={sec.questions.map((q) => [q.label, intakeValue(a[q.id])] as [string, ReactNode])} /></div>
        ))}
      </Card>
    );
  }

  if (tab === "files") {
    const rows = await Promise.all(files.map(async (f) => ({ ...f, url: await pcSignedUrl(f.storage_path) })));
    return (
      <Card>
        <table className="table"><thead><tr><th>File</th><th>Kind</th><th>Added</th><th /></tr></thead><tbody>
          {b.agreementUrl && <tr><td>Signed agreement {s.agreement_id}</td><td><Pill tone="mute">agreement</Pill></td><td className="text-dim">{fmtD(s.agreement_signed_at)}</td><td className="text-right"><a className="text-gold-soft" href={b.agreementUrl} target="_blank" rel="noreferrer">open</a></td></tr>}
          {rows.map((f) => <tr key={f.id}><td>{f.label || f.storage_path.split("/").pop()}</td><td><Pill tone="mute">{f.kind}</Pill></td><td className="text-dim">{fmtD(f.created_at)}</td><td className="text-right">{f.url && <a className="text-gold-soft" href={f.url} target="_blank" rel="noreferrer">open</a>}</td></tr>)}
          {!rows.length && !b.agreementUrl && <tr><td colSpan={4} className="text-mute">No files yet.</td></tr>}
        </tbody></table>
      </Card>
    );
  }

  // profile
  return (
    <Card>
      <KV rows={[
        ["Email", <>{s.email}{s.alt_emails?.length ? <span className="text-mute"> (also {s.alt_emails.join(", ")})</span> : null}</>],
        ["Phone", s.phone || "—"],
        ["Address", s.address || "—"],
        ...(s.is_company ? [["Company", <span key="company">{s.company_name}{s.company_number && ` · ${s.company_number}`}{s.company_role && ` · ${s.company_role}`}<div className="text-mute text-xs">{s.company_address || s.address}</div></span>] as [string, ReactNode]] : []),
        ["Agreement", <>{s.agreement_id || "—"} · signed {fmtD(s.agreement_signed_at)}{b.agreementUrl && <> · <a className="text-gold-soft" href={b.agreementUrl} target="_blank" rel="noreferrer">PDF</a></>}</>],
        ["Stripe", <>{s.stripe_customer_id ? <a className="text-gold-soft" href={`https://dashboard.stripe.com/customers/${s.stripe_customer_id}`} target="_blank" rel="noreferrer">{s.stripe_customer_id}</a> : "—"} · paid {fmtD(s.paid_at)}</>],
        ["Booking link", s.booking_url ? <a className="text-gold-soft break-all" href={s.booking_url} target="_blank" rel="noreferrer">{s.booking_url}</a> : "—"],
        // eslint-disable-next-line react/jsx-key -- tuple rows are keyed inside KV
        ["Intake link", <span className="flex items-center gap-2 flex-wrap"><code className="text-xs break-all">{intakeUrl}</code><CopyLink url={intakeUrl} /></span>],
      ]} />
      <div className="mt-5 pt-5 border-t border-line"><ProfileForm student={s} /></div>
    </Card>
  );
}
