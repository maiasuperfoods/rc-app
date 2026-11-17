"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/** A student asks for access to a partner. Staff approve it and send the link from the referral desk. */
export async function requestPartnerAccess(partnerId: string, note: string): Promise<Result> {
  try {
    const ctx = await getContext({ requireTenant: true });
    if (ctx.demo) return { ok: false, error: "Requests are saved once the app is connected to the student database." };
    const t = ctx.tenant!;
    if (!ctx.memberships.some((m) => m.tenantId === t.id)) return { ok: false, error: "Only the brand's own team can request access." };
    const sb = await supabaseServer();
    const { error } = await sb.from("referral_requests").insert({
      tenant_id: t.id, partner_id: partnerId, requested_by: ctx.user.id,
      requester_email: ctx.user.email, requester_name: ctx.user.name, tenant_name: t.name, note: note.trim().slice(0, 1000),
    });
    if (error) return { ok: false, error: error.code === "23505" ? "You have already requested this partner." : error.message };
    revalidatePath("/resources/partners");
    revalidatePath("/admin/referrals");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
