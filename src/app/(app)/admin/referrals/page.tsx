import Link from "next/link";
import { requireReferralStaff } from "@/lib/data";
import { getDesk, referralStage } from "@/lib/referrals";
import { PageHeader } from "@/components/ui";
import { CommissionsTab, PartnersTab, RequestsTab, TeamTab } from "./desk";

export const metadata = { title: "Referrals · Renaissance Commerce" };
export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireReferralStaff();
  const { tab: raw } = await searchParams;
  const desk = await getDesk(ctx.isCoach);
  const tabs = [["requests", "Requests"], ["commissions", "Commissions"], ["partners", "Partners"], ...(ctx.isCoach ? [["team", "Team"]] : [])] as [string, string][];
  const tab = tabs.some(([k]) => k === raw) ? raw! : "requests";

  const tracking = new Map(desk.tracking.map((t) => [t.requestId, t]));
  const stages = desk.requests.map((r) => referralStage(r, tracking.get(r.id), desk.payments.filter((p) => p.requestId === r.id)));
  const count = (s: string) => stages.filter((x) => x === s).length;
  const due = desk.payments.filter((p) => p.status === "due").reduce((a, p) => a + p.amount, 0);
  const paid = desk.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const overdue = desk.payments.filter((p) => p.status === "due" && p.dueOn && p.dueOn < new Date().toISOString().slice(0, 10)).length;
  const tiles = [
    ["Waiting for approval", String(count("requested")), count("requested") > 0 ? "text-gold" : "text-ink", "Approve and send the link"],
    ["Sent, not confirmed", String(count("sent")), "text-ink", "Ask the vendor if they signed up"],
    ["Commission due", money(due), due > 0 ? "text-warn" : "text-ink", overdue > 0 ? `${overdue} past the due date` : "Chase on the Commissions tab"],
    ["Commission received", money(paid), "text-ink", "All time"],
  ];

  return (
    <>
      <PageHeader title="Referrals" subtitle="Who we sent to which partner, where each one stands, and what the partner owes us." actions={
          // A file download, not a page: next/link would try to render it.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a className="btn btn-secondary" href="/admin/referrals/export">Export everything (CSV)</a>
        } />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {tiles.map(([label, value, tone, hint]) => (
          <div key={label} className="card p-4">
            <div className="label">{label}</div>
            <div className={`numeral text-2xl mt-1 ${tone}`}>{value}</div>
            <div className="text-xs text-mute mt-1">{hint}</div>
          </div>
        ))}
      </div>
      <nav className="flex gap-1 border-b border-line mb-6 overflow-x-auto" aria-label="Referral desk sections">
        {tabs.map(([k, label]) => (
          <Link key={k} href={k === "requests" ? "/admin/referrals" : `/admin/referrals?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`shrink-0 px-3 py-2 -mb-px border-b-2 text-sm ${tab === k ? "border-gold text-ink font-medium" : "border-transparent text-dim hover:text-ink"}`}>{label}</Link>
        ))}
      </nav>
      {tab === "requests" && <RequestsTab desk={desk} />}
      {tab === "commissions" && <CommissionsTab desk={desk} />}
      {tab === "partners" && <PartnersTab desk={desk} />}
      {tab === "team" && <TeamTab desk={desk} />}
    </>
  );
}
