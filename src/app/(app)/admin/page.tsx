import Link from "next/link";
import { requireCoach } from "@/lib/data";
import { buildSnapshot } from "@/lib/snapshot";
import { Card, PageHeader, Pill, fmtMoney, fmtX, timeAgo } from "@/components/ui";

const STAGE = { grind: "Grind", validation: "Validation", acceleration: "Acceleration", expansion: "Expansion" } as const;

export default async function AdminPage() {
  const ctx = await requireCoach();
  const snaps = await Promise.all(ctx.tenants.map((t) => buildSnapshot(ctx.db, t)));
  const red = snaps.reduce((a, s) => a + s.flags.filter((f) => f.severity === "red").length, 0);
  const broken = snaps.reduce((a, s) => a + s.integrations.filter((i) => i.lastError).length, 0);
  return (
    <>
      <PageHeader title="All students" subtitle={`${ctx.tenants.length} brands · ${red} red flags · ${broken} connections needing attention. Click a brand for the call-prep page.`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Brand</th><th>Stage</th><th className="num">Rev / wk</th><th className="num">ROAS</th><th className="num">NCPA</th><th className="num">Allowable</th><th className="num">CM %</th><th>Flags</th><th>Connections</th><th>Last sync</th></tr></thead>
            <tbody>
              {snaps.map((s) => {
                const m = s.week.metrics;
                const allow = s.ue.blended?.allowableCac ?? null;
                const okCount = s.integrations.filter((i) => i.connected && !i.lastError).length;
                const lastSync = s.integrations.map((i) => i.lastSyncAt).filter(Boolean).sort().pop() ?? null;
                return (
                  <tr key={s.tenant.id}>
                    <td><Link href={`/admin/${s.tenant.id}`} className="text-ink hover:text-gold-soft font-medium">{s.tenant.name}</Link><div className="text-xs text-mute">{s.tenant.domain}</div></td>
                    <td><Pill tone="gold">{STAGE[s.tenant.stage]}</Pill></td>
                    <td className="num">{s.daily.length ? fmtMoney(m.revenue) : "—"}</td>
                    <td className="num">{s.daily.length ? fmtX(m.blendedRoas) : "—"}</td>
                    <td className={`num ${allow != null && m.ncpa > allow ? "text-bad" : ""}`}>{s.daily.length ? fmtMoney(m.ncpa) : "—"}</td>
                    <td className="num text-dim">{fmtMoney(allow)}</td>
                    <td className="num">{s.daily.length ? `${Math.round(m.contributionMarginPct * 100)}%` : "—"}</td>
                    <td>
                      <div className="flex gap-1">
                        {s.flags.filter((f) => f.severity === "red").length > 0 && <Pill tone="bad">{s.flags.filter((f) => f.severity === "red").length} red</Pill>}
                        {s.flags.filter((f) => f.severity === "amber").length > 0 && <Pill tone="warn">{s.flags.filter((f) => f.severity === "amber").length} amber</Pill>}
                        {s.flags.length === 0 && <Pill tone="good">clean</Pill>}
                      </div>
                    </td>
                    <td><Pill tone={s.integrations.some((i) => i.lastError) ? "warn" : okCount >= 3 ? "good" : "mute"}>{okCount}/5{s.integrations.some((i) => i.lastError) ? " · error" : ""}</Pill></td>
                    <td className="text-dim text-xs">{timeAgo(lastSync)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
