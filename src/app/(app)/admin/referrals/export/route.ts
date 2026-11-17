import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/data";
import { STAGE_LABEL, getDesk, referralStage } from "@/lib/referrals";

export const dynamic = "force-dynamic";

// A leading =, +, - or @ would run as a formula when the file is opened in a spreadsheet.
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per commission entry, or one row for a referral with none yet. Staff only. */
export async function GET(req: NextRequest) {
  const ctx = await getContext();
  if (!ctx.isCoach && !ctx.isVa) return new NextResponse("Not found", { status: 404 });
  const only = req.nextUrl.searchParams.get("partner");
  const desk = await getDesk(false);
  const partners = new Map(desk.partners.map((p) => [p.id, p]));
  const terms = new Map(desk.terms.map((t) => [t.partnerId, t]));
  const tracking = new Map(desk.tracking.map((t) => [t.requestId, t]));
  const head = ["Partner", "Category", "Agreed commission", "Brand", "Student", "Student email", "Requested", "Link sent", "Status", "Signed up", "Vendor reference", "Next follow-up", "Commission amount (USD)", "Period", "Commission status", "Due date", "Paid date", "Payment reference", "Notes"];
  const lines = [head.map(cell).join(",")];
  for (const r of desk.requests) {
    if (only && r.partnerId !== only) continue;
    const p = partners.get(r.partnerId), t = tracking.get(r.id), pays = desk.payments.filter((x) => x.requestId === r.id);
    const base = [p?.name, p?.category, terms.get(r.partnerId)?.commissionRate, r.tenantName, r.requesterName, r.requesterEmail, r.createdAt.slice(0, 10), r.status === "sent" ? r.decidedAt?.slice(0, 10) : "", STAGE_LABEL[referralStage(r, t, pays)], t?.signedUpOn, t?.vendorRef, t?.followUpOn];
    if (pays.length === 0) lines.push([...base, "", "", "", "", "", "", t?.notes].map(cell).join(","));
    for (const pay of pays) lines.push([...base, pay.amount.toFixed(2), pay.period, pay.status, pay.dueOn, pay.paidOn, pay.reference, t?.notes].map(cell).join(","));
  }
  const name = only ? `referrals-${(partners.get(only)?.name ?? "partner").toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "referrals";
  return new NextResponse(lines.join("\n") + "\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
