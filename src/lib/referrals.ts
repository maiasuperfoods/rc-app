import { isDemoMode, supabaseServer } from "@/lib/supabase/server";

/**
 * Referral partners. Students see the directory and their own brand's requests; commission
 * terms, contacts, agreements and payments are read only by coaches and referral assistants
 * (row level security enforces this, not the UI).
 */

import type { Desk, Partner, PartnerTerms, Payment, ReferralRequest, Tracking } from "./referrals-shared";
export * from "./referrals-shared";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const mapPartner = (r: Row): Partner => ({ id: r.id, name: r.name, category: r.category, description: r.description ?? "", website: r.website, listed: r.listed });
const mapTerms = (r: Row): PartnerTerms => ({
  partnerId: r.partner_id, contactName: r.contact_name, contactEmail: r.contact_email, contactPhone: r.contact_phone,
  agreementStatus: r.agreement_status, commissionRate: r.commission_rate, commissionType: r.commission_type,
  howCollected: r.how_collected, payoutSchedule: r.payout_schedule, referralLink: r.referral_link, referralCode: r.referral_code,
  verifyWhere: r.verify_where, notes: r.notes, agreementPath: r.agreement_path, agreementName: r.agreement_name, agreementDate: r.agreement_date,
});
const mapRequest = (r: Row): ReferralRequest => ({
  id: r.id, tenantId: r.tenant_id, partnerId: r.partner_id, requesterEmail: r.requester_email, requesterName: r.requester_name, tenantName: r.tenant_name,
  note: r.note ?? "", status: r.status, accessLink: r.access_link, accessCode: r.access_code, message: r.message, decidedAt: r.decided_at, createdAt: r.created_at,
});
const mapTracking = (r: Row): Tracking => ({ requestId: r.request_id, signedUpOn: r.signed_up_on, vendorRef: r.vendor_ref, followUpOn: r.follow_up_on, notes: r.notes });
const mapPayment = (r: Row): Payment => ({ id: r.id, requestId: r.request_id, amount: Number(r.amount), currency: r.currency, period: r.period, status: r.status, dueOn: r.due_on, paidOn: r.paid_on, reference: r.reference, notes: r.notes });

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** What a student sees: listed partners and their own brand's requests. */
export async function getStudentPartners(tenantId: string | null): Promise<{ partners: Partner[]; requests: ReferralRequest[] }> {
  if (isDemoMode()) return { partners: DEMO.partners.filter((p) => p.listed), requests: DEMO.requests.filter((r) => r.tenantId === tenantId) };
  const sb = await supabaseServer();
  const [partners, requests] = await Promise.all([
    sb.from("referral_partners").select("*").eq("listed", true).order("category").order("name"),
    tenantId ? sb.from("referral_requests").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  return { partners: must<Row[]>(partners).map(mapPartner), requests: must<Row[]>(requests).map(mapRequest) };
}

/** Everything the referral desk works from. Staff only. */
export async function getDesk(includeStaff: boolean): Promise<Desk> {
  if (isDemoMode()) return DEMO;
  const sb = await supabaseServer();
  const [partners, terms, requests, tracking, payments, staff] = await Promise.all([
    sb.from("referral_partners").select("*").order("category").order("name"),
    sb.from("referral_partner_terms").select("*"),
    sb.from("referral_requests").select("*").order("created_at", { ascending: false }),
    sb.from("referral_tracking").select("*"),
    sb.from("referral_payments").select("*").order("created_at"),
    includeStaff ? sb.from("referral_staff").select("user_id,email,name").order("created_at") : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    partners: must<Row[]>(partners).map(mapPartner),
    terms: must<Row[]>(terms).map(mapTerms),
    requests: must<Row[]>(requests).map(mapRequest),
    tracking: must<Row[]>(tracking).map(mapTracking),
    payments: must<Row[]>(payments).map(mapPayment),
    staff: must<Row[]>(staff).map((r) => ({ userId: r.user_id, email: r.email, name: r.name })),
  };
}

/** How many requests are waiting for approval; 0 if the caller may not see them. */
export async function pendingReferralCount(): Promise<number> {
  if (isDemoMode()) return DEMO.requests.filter((r) => r.status === "requested").length;
  const sb = await supabaseServer();
  const { count } = await sb.from("referral_requests").select("id", { count: "exact", head: true }).eq("status", "requested");
  return count ?? 0;
}

// Invented sample data for demo mode only.
const blankTerms = (partnerId: string, over: Partial<PartnerTerms> = {}): PartnerTerms => ({
  partnerId, contactName: null, contactEmail: null, contactPhone: null, agreementStatus: "none", commissionRate: null, commissionType: "unknown",
  howCollected: null, payoutSchedule: null, referralLink: null, referralCode: null, verifyWhere: null, notes: null, agreementPath: null, agreementName: null, agreementDate: null, ...over,
});
const DEMO: Desk = {
  partners: [
    { id: "p1", name: "Northpay", category: "Payment Processing", description: "Merchant accounts for supplement and beauty brands.", website: null, listed: true },
    { id: "p2", name: "Shipwell 3PL", category: "Fulfillment", description: "US fulfillment with two-day ground coverage.", website: null, listed: true },
    { id: "p3", name: "Keepback", category: "Retention", description: "Email and SMS retention agency.", website: null, listed: true },
    { id: "p4", name: "Ledgerline CPA", category: "Accounting", description: "", website: null, listed: true },
  ],
  terms: [
    blankTerms("p1", { agreementStatus: "agreed", commissionRate: "10%", commissionType: "recurring", contactName: "Dana", contactEmail: "dana@example.com", howCollected: "Monthly wire after their residual report", payoutSchedule: "Monthly, by the 15th", referralLink: "https://example.com/northpay?ref=rc", verifyWhere: "Partner portal, Referrals tab" }),
    blankTerms("p2", { agreementStatus: "agreed", commissionRate: "$250 per account", commissionType: "one_time", contactName: "Marco", referralCode: "RC250" }),
    blankTerms("p3", { agreementStatus: "in_talks", commissionRate: "15%" }),
    blankTerms("p4"),
  ],
  requests: [
    { id: "r1", tenantId: "t-glowbright", partnerId: "p3", requesterEmail: "student@example.com", requesterName: "Demo Student", tenantName: "Glowbright Labs", note: "Looking for help with our welcome flow.", status: "requested", accessLink: null, accessCode: null, message: null, decidedAt: null, createdAt: "2026-11-15T14:00:00Z" },
    { id: "r2", tenantId: "t-glowbright", partnerId: "p1", requesterEmail: "student@example.com", requesterName: "Demo Student", tenantName: "Glowbright Labs", note: "", status: "sent", accessLink: "https://example.com/northpay?ref=rc", accessCode: null, message: "Use this link so they know you came from us.", decidedAt: "2026-10-02T15:00:00Z", createdAt: "2026-10-01T14:00:00Z" },
    { id: "r3", tenantId: "t-other", partnerId: "p2", requesterEmail: "owner@example.com", requesterName: "Sample Owner", tenantName: "Harbor & Pine", note: "", status: "sent", accessLink: null, accessCode: "RC250", message: null, decidedAt: "2026-09-12T15:00:00Z", createdAt: "2026-09-11T14:00:00Z" },
  ],
  tracking: [
    { requestId: "r2", signedUpOn: "2026-10-09", vendorRef: "MID 4471", followUpOn: "2026-12-01", notes: null },
    { requestId: "r3", signedUpOn: "2026-09-20", vendorRef: null, followUpOn: null, notes: null },
  ],
  payments: [
    { id: "y1", requestId: "r2", amount: 184.5, currency: "USD", period: "October 2026", status: "due", dueOn: "2026-11-15", paidOn: null, reference: null, notes: null },
    { id: "y2", requestId: "r3", amount: 250, currency: "USD", period: null, status: "paid", dueOn: "2026-10-15", paidOn: "2026-10-14", reference: "Wire 88213", notes: null },
  ],
  staff: [],
};
