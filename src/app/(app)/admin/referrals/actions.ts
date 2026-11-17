"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireCoach, requireReferralStaff } from "@/lib/data";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { setPasswordLink } from "@/lib/admin-api";
import { sendAssistantInvite } from "@/lib/pc/email";
import type { AgreementStatus, CommissionType } from "@/lib/referrals-shared";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type SB = Awaited<ReturnType<typeof supabaseServer>>;

const clean = (v: unknown, max = 2000) => { const s = String(v ?? "").trim().slice(0, max); return s === "" ? null : s; };
const day = (v: unknown) => { const s = String(v ?? "").trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
const url = (v: unknown) => { const s = clean(v, 500); if (!s) return null; if (!/^https?:\/\//i.test(s)) throw new Error("Links must start with https://"); return s; };

async function staff<T extends object>(fn: (sb: SB, userId: string) => Promise<T | void>, coachOnly = false): Promise<Result<T>> {
  try {
    const ctx = coachOnly ? await requireCoach() : await requireReferralStaff();
    if (ctx.demo) return { ok: false, error: "This is sample data. Changes are saved once the app is connected to the student database." };
    const out = await fn(await supabaseServer(), ctx.user.id);
    revalidatePath("/admin/referrals");
    revalidatePath("/resources/partners");
    return { ok: true, ...((out ?? {}) as T) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
const check = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };

export interface PartnerInput { id?: string; name: string; category: string; description: string; website: string; listed: boolean }
export async function savePartner(input: PartnerInput) {
  return staff(async (sb) => {
    const name = clean(input.name, 120);
    if (!name) throw new Error("Give the partner a name.");
    const row = { name, category: clean(input.category, 80) ?? "Other", description: clean(input.description, 600) ?? "", website: url(input.website), listed: Boolean(input.listed) };
    if (input.id) check(await sb.from("referral_partners").update(row).eq("id", input.id));
    else {
      const r = await sb.from("referral_partners").insert(row).select("id").single();
      check(r);
      check(await sb.from("referral_partner_terms").insert({ partner_id: r.data!.id }));
    }
  });
}

export async function setPartnerListed(id: string, listed: boolean) {
  return staff(async (sb) => check(await sb.from("referral_partners").update({ listed }).eq("id", id)));
}

export async function deletePartner(id: string) {
  return staff(async (sb) => {
    const r = await sb.from("referral_partners").delete().eq("id", id);
    if (r.error) throw new Error(r.error.code === "23503" ? "This partner has referrals on record, so it can't be deleted. Hide it from students instead." : r.error.message);
  });
}

export interface TermsInput {
  contactName: string; contactEmail: string; contactPhone: string;
  agreementStatus: AgreementStatus; commissionRate: string; commissionType: CommissionType;
  howCollected: string; payoutSchedule: string; referralLink: string; referralCode: string; verifyWhere: string; notes: string; agreementDate: string;
  /** Set when a new file was uploaded with this save. */
  agreementPath?: string; agreementName?: string;
}
export async function saveAgreement(partnerId: string, t: TermsInput) {
  return staff(async (sb) => {
    const row: Record<string, unknown> = {
      partner_id: partnerId,
      contact_name: clean(t.contactName, 120), contact_email: clean(t.contactEmail, 200), contact_phone: clean(t.contactPhone, 60),
      agreement_status: ["none", "in_talks", "agreed"].includes(t.agreementStatus) ? t.agreementStatus : "none",
      commission_rate: clean(t.commissionRate, 120),
      commission_type: ["unknown", "one_time", "recurring"].includes(t.commissionType) ? t.commissionType : "unknown",
      how_collected: clean(t.howCollected, 600), payout_schedule: clean(t.payoutSchedule, 200),
      referral_link: url(t.referralLink), referral_code: clean(t.referralCode, 120), verify_where: clean(t.verifyWhere, 400), notes: clean(t.notes),
      agreement_date: day(t.agreementDate), updated_at: new Date().toISOString(),
    };
    if (t.agreementPath) {
      if (!t.agreementPath.startsWith(`${partnerId}/`)) throw new Error("That file belongs to a different partner.");
      row.agreement_path = t.agreementPath;
      row.agreement_name = clean(t.agreementName, 200) ?? "Agreement";
    }
    check(await sb.from("referral_partner_terms").upsert(row));
  });
}

/** A one-time upload slot in the private agreements bucket. The browser sends the file straight to storage. */
export async function agreementUploadSlot(partnerId: string, filename: string) {
  return staff(async (sb) => {
    const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || "agreement";
    const path = `${partnerId}/${Date.now()}-${safe}`;
    const r = await sb.storage.from("partner-agreements").createSignedUploadUrl(path);
    if (r.error) throw new Error(r.error.message);
    return { path, token: r.data.token };
  });
}

export async function agreementDownloadUrl(partnerId: string) {
  return staff(async (sb) => {
    const t = await sb.from("referral_partner_terms").select("agreement_path").eq("partner_id", partnerId).maybeSingle();
    check(t);
    if (!t.data?.agreement_path) throw new Error("No agreement file is attached.");
    const r = await sb.storage.from("partner-agreements").createSignedUrl(t.data.agreement_path, 300);
    if (r.error) throw new Error(r.error.message);
    return { url: r.data.signedUrl };
  });
}

export async function approveRequest(id: string, input: { link: string; code: string; message: string }) {
  return staff(async (sb, userId) => {
    const link = url(input.link), code = clean(input.code, 120);
    if (!link && !code) throw new Error("Add the referral link or the code you are sending.");
    check(await sb.from("referral_requests").update({ status: "sent", access_link: link, access_code: code, message: clean(input.message, 1500), decided_by: userId, decided_at: new Date().toISOString() }).eq("id", id));
  });
}

export async function declineRequest(id: string, message: string) {
  return staff(async (sb, userId) => {
    check(await sb.from("referral_requests").update({ status: "declined", access_link: null, access_code: null, message: clean(message, 1500), decided_by: userId, decided_at: new Date().toISOString() }).eq("id", id));
  });
}

export async function saveTracking(requestId: string, input: { signedUpOn: string; vendorRef: string; followUpOn: string; notes: string }) {
  return staff(async (sb) => {
    check(await sb.from("referral_tracking").upsert({ request_id: requestId, signed_up_on: day(input.signedUpOn), vendor_ref: clean(input.vendorRef, 200), follow_up_on: day(input.followUpOn), notes: clean(input.notes), updated_at: new Date().toISOString() }));
  });
}

export async function addPayment(requestId: string, input: { amount: string; period: string; dueOn: string; paid: boolean; paidOn: string; reference: string }) {
  return staff(async (sb) => {
    const amount = Number(String(input.amount).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter the commission amount.");
    check(await sb.from("referral_payments").insert({
      request_id: requestId, amount, period: clean(input.period, 80), due_on: day(input.dueOn),
      status: input.paid ? "paid" : "due", paid_on: input.paid ? day(input.paidOn) ?? new Date().toISOString().slice(0, 10) : null, reference: clean(input.reference, 200),
    }));
  });
}

export async function markPaymentPaid(id: string, input: { paidOn: string; reference: string }) {
  return staff(async (sb) => {
    check(await sb.from("referral_payments").update({ status: "paid", paid_on: day(input.paidOn) ?? new Date().toISOString().slice(0, 10), reference: clean(input.reference, 200) }).eq("id", id));
  });
}

export async function markPaymentDue(id: string) {
  return staff(async (sb) => check(await sb.from("referral_payments").update({ status: "due", paid_on: null }).eq("id", id)));
}

export async function deletePayment(id: string) {
  return staff(async (sb) => check(await sb.from("referral_payments").delete().eq("id", id)));
}

/** Gives someone the referral desk and nothing else. Returns a link they open to set a password. Coaches only. */
export async function inviteAssistant(emailRaw: string, name: string) {
  return staff(async (_sb, userId) => {
    const email = emailRaw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email.");
    const admin = supabaseAdmin();
    let type: "invite" | "recovery" = "invite";
    let link = await admin.auth.admin.generateLink({ type: "invite", email });
    if (link.error) { type = "recovery"; link = await admin.auth.admin.generateLink({ type: "recovery", email }); }
    if (link.error || !link.data.user) throw new Error(link.error?.message ?? "Could not create the account.");
    const r = await admin.from("referral_staff").upsert({ user_id: link.data.user.id, email, name: clean(name, 120), added_by: userId });
    if (r.error) throw new Error(r.error.message);
    const h = await headers();
    const app = (process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`).replace(/\/$/, "");
    const setPasswordUrl = setPasswordLink(app, link.data.properties.hashed_token, type);
    let emailedTo: string | undefined, emailError: string | undefined;
    try { await sendAssistantInvite({ email, name: clean(name, 120), setPasswordUrl, appUrl: app }); emailedTo = email; } catch (e) { emailError = e instanceof Error ? e.message : "The email could not be sent."; }
    return { link: setPasswordUrl, emailedTo, emailError };
  }, true);
}

export async function removeAssistant(userId: string) {
  return staff(async () => {
    const r = await supabaseAdmin().from("referral_staff").delete().eq("user_id", userId);
    if (r.error) throw new Error(r.error.message);
  }, true);
}
