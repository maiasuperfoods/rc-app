import Link from "next/link";
import { after } from "next/server";
import { runProvisioning } from "@/lib/jobs/provision";
import { requireCoach } from "@/lib/data";
import { buildSnapshot } from "@/lib/snapshot";
import { pcConfigured } from "@/lib/pc/client";
import { roster } from "@/lib/pc/queries";
import type { RosterRow } from "@/lib/pc/types";
import { Card, PageHeader, Pill, fmtMoney, timeAgo } from "@/components/ui";
import { fmtD, fmtDT } from "@/components/coaching/format";
import { intakeLabel, intakeTone, statusTone } from "@/components/coaching/desk";
import { AddStudentForm } from "@/components/coaching/desk-client";

const STAGE = { grind: "Grind", validation: "Validation", acceleration: "Acceleration", expansion: "Expansion" } as const;

export default async function AdminPage() {
  const ctx = await requireCoach();
  const coaching = pcConfigured();
  if (coaching) after(() => runProvisioning().catch(() => {}));
  const [snaps, students] = await Promise.all([Promise.all(ctx.tenants.map((t) => buildSnapshot(ctx.db, t))), coaching ? roster().catch(() => [] as RosterRow[]) : Promise.resolve([] as RosterRow[])]);
  const byStudent = new Map(snaps.filter((s) => s.tenant.pcStudentId).map((s) => [s.tenant.pcStudentId!, s]));
  const unlinkedBrands = snaps.filter((s) => !s.tenant.pcStudentId);
  const red = snaps.reduce((a, s) => a + s.flags.filter((f) => f.severity === "red").length, 0);
  const active = students.filter((s) => s.status === "active");
  const fee = Number(process.env.FEE_USD || 3000);
  const overdue = students.reduce((a, s) => a + s.overdueActions, 0);

  const rows: { key: string; href: string; name: string; sub: string | null; student: RosterRow | null; snap: (typeof snaps)[number] | null }[] = [
    ...students.map((st) => { const snap = byStudent.get(st.id) ?? null; return { key: st.id, href: snap ? `/admin/${snap.tenant.id}` : `/admin/pc/${st.id}`, name: `${st.first_name} ${st.last_name}`, sub: snap ? `${snap.tenant.name}${snap.tenant.domain ? ` · ${snap.tenant.domain}` : ""}` : st.company_name, student: st, snap }; }),
    ...unlinkedBrands.map((snap) => ({ key: snap.tenant.id, href: `/admin/${snap.tenant.id}`, name: snap.tenant.name, sub: snap.tenant.domain, student: null, snap })),
  ];

  const subtitle = coaching
    ? `${students.length} students · ${active.length} active · ${fmtMoney(active.length * fee)} MRR · ${snaps.length} brands on the platform · ${red} red flags · ${overdue} overdue commitments`
    : `${ctx.tenants.length} brands · ${red} red flags. Coaching data is not connected yet.`;

  return (
    <>
      <PageHeader title="All students" subtitle={subtitle} />
      {rows.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-dim text-sm mb-4">No students yet. They appear here as soon as someone signs the Private Circle agreement; brands are created automatically once they have paid and completed the intake.</p>
            <Link href="/admin/access" className="btn btn-primary">Add a brand and invite its student</Link>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student</th><th>Program</th><th>Intake</th><th>Platform</th><th>Joined</th><th>Last call</th><th>Next call</th><th className="num">Open items</th><th className="num">Rev / wk</th><th>Flags</th><th>Connections</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const s = r.snap; const st = r.student;
                  const m = s?.week.metrics;
                  const okCount = s ? s.integrations.filter((i) => i.connected && !i.lastError).length : 0;
                  const lastSync = s ? s.integrations.map((i) => i.lastSyncAt).filter(Boolean).sort().pop() ?? null : null;
                  return (
                    <tr key={r.key}>
                      <td><Link href={r.href} className="text-ink hover:text-gold-soft font-medium">{r.name}</Link>{r.sub && <div className="text-xs text-mute">{r.sub}</div>}</td>
                      <td>{st ? <Pill tone={statusTone(st.status)}>{st.status}</Pill> : <Pill tone="mute">no program record</Pill>}</td>
                      <td>{st ? <Pill tone={intakeTone(st.intake_status)}>{intakeLabel(st.intake_status)}</Pill> : <span className="text-mute">—</span>}</td>
                      <td>{s ? <Pill tone="gold">{STAGE[s.tenant.stage]}</Pill> : st && st.status === "active" && st.intake_status === "complete" ? <Pill tone="warn">pending</Pill> : <Pill tone="mute">not yet</Pill>}</td>
                      <td className="text-dim whitespace-nowrap">{st ? fmtD(st.paid_at || st.agreement_signed_at || st.created_at) : s ? fmtD(s.tenant.createdAt) : "—"}</td>
                      <td className="text-dim whitespace-nowrap">{st ? fmtD(st.lastCall) : "—"}</td>
                      <td className="text-dim whitespace-nowrap">{st ? fmtDT(st.nextCall) : "—"}</td>
                      <td className="num">{st ? (st.openActions ? <span className={st.overdueActions ? "text-bad" : ""}>{st.openActions}{st.overdueActions ? ` (${st.overdueActions} overdue)` : ""}</span> : "—") : "—"}</td>
                      <td className="num">{s && s.daily.length && m ? fmtMoney(m.revenue) : "—"}</td>
                      <td>{s ? <div className="flex gap-1">{s.flags.filter((f) => f.severity === "red").length > 0 && <Pill tone="bad">{s.flags.filter((f) => f.severity === "red").length} red</Pill>}{s.flags.filter((f) => f.severity === "amber").length > 0 && <Pill tone="warn">{s.flags.filter((f) => f.severity === "amber").length} amber</Pill>}{s.flags.length === 0 && <Pill tone="good">clean</Pill>}</div> : "—"}</td>
                      <td>{s ? <span className="flex items-center gap-2"><Pill tone={s.integrations.some((i) => i.lastError) ? "warn" : okCount >= 3 ? "good" : "mute"}>{okCount}/5{s.integrations.some((i) => i.lastError) ? " · error" : ""}</Pill><span className="text-xs text-mute">{timeAgo(lastSync)}</span></span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {coaching && (
        <Card title="Add a student manually" hint="For someone who joins outside the signing flow. They start as 'signed'; mark them paid from their Profile tab." className="mt-4">
          <AddStudentForm />
        </Card>
      )}
    </>
  );
}
