/** Referral partner types and pure helpers, safe to import from client components. */

export type AgreementStatus = "none" | "in_talks" | "agreed";
export type CommissionType = "unknown" | "one_time" | "recurring";
export type RequestStatus = "requested" | "sent" | "declined";
export type ReferralStage = "requested" | "sent" | "signed_up" | "due" | "paid" | "declined";

export interface Partner { id: string; name: string; category: string; description: string; website: string | null; listed: boolean }
export interface PartnerTerms {
  partnerId: string;
  contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  agreementStatus: AgreementStatus;
  commissionRate: string | null; commissionType: CommissionType;
  howCollected: string | null; payoutSchedule: string | null;
  referralLink: string | null; referralCode: string | null;
  verifyWhere: string | null; notes: string | null;
  agreementPath: string | null; agreementName: string | null; agreementDate: string | null;
}
export interface ReferralRequest {
  id: string; tenantId: string | null; partnerId: string;
  requesterEmail: string; requesterName: string; tenantName: string; note: string;
  status: RequestStatus; accessLink: string | null; accessCode: string | null; message: string | null;
  decidedAt: string | null; createdAt: string;
}
export interface Tracking { requestId: string; signedUpOn: string | null; vendorRef: string | null; followUpOn: string | null; notes: string | null }
export interface Payment { id: string; requestId: string; amount: number; currency: string; period: string | null; status: "due" | "paid"; dueOn: string | null; paidOn: string | null; reference: string | null; notes: string | null }
export interface StaffMember { userId: string; email: string; name: string | null }

export interface Desk { partners: Partner[]; terms: PartnerTerms[]; requests: ReferralRequest[]; tracking: Tracking[]; payments: Payment[]; staff: StaffMember[] }

export const STAGE_LABEL: Record<ReferralStage, string> = { requested: "Waiting for approval", sent: "Link sent", signed_up: "Signed up", due: "Commission due", paid: "Paid", declined: "Declined" };
export const STAGE_TONE: Record<ReferralStage, "gold" | "info" | "good" | "warn" | "mute"> = { requested: "gold", sent: "info", signed_up: "info", due: "warn", paid: "good", declined: "mute" };
export const AGREEMENT_LABEL: Record<AgreementStatus, string> = { none: "No agreement yet", in_talks: "In talks", agreed: "Agreement reached" };

/** Where a referral stands, from the request, what the vendor confirmed, and what has been paid. */
export function referralStage(r: ReferralRequest, t: Tracking | undefined, pays: Payment[]): ReferralStage {
  if (r.status === "declined") return "declined";
  if (r.status === "requested") return "requested";
  if (pays.some((p) => p.status === "due")) return "due";
  if (pays.length > 0) return "paid";
  return t?.signedUpOn ? "signed_up" : "sent";
}

