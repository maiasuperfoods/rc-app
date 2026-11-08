"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/data";
import { adminApi, setPasswordLink } from "@/lib/admin-api";

type Result = { ok: true; link?: string; note?: string; password?: string; email?: string } | { ok: false; error: string };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function run(fn: () => Promise<Result>): Promise<Result> {
  try {
    const ctx = await requireCoach();
    if (ctx.demo) return { ok: false, error: "Invites work once the app is connected to the student database." };
    const r = await fn();
    revalidatePath("/admin", "layout");
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function inviteStudent(input: { email: string; brandName?: string; tenantId?: string }) {
  return run(async () => {
    const r = await adminApi<{ token_hash: string; type: string; existing: boolean }>({ action: "invite", role: "student", ...input });
    return { ok: true, link: setPasswordLink(await origin(), r.token_hash, r.type), note: r.existing ? "They already had an account: the link lets them set a new password, and the brand is added to it." : undefined };
  });
}

/** Coaches live in the admin project (os_members). They get a temporary password and must change it on first sign-in. */
export async function inviteCoach(email: string, name?: string) {
  return run(async () => {
    const r = await adminApi<{ id: string; email: string; password: string }>({ action: "invite-coach", email, name });
    return { ok: true, email: r.email, password: r.password };
  });
}

export async function resetCoachPassword(id: string) {
  return run(async () => {
    const r = await adminApi<{ password: string }>({ action: "coach-reset", id });
    return { ok: true, password: r.password };
  });
}

export async function removeCoach(id: string) {
  return run(async () => {
    await adminApi({ action: "remove-coach", id });
    return { ok: true };
  });
}

/** Creates (or resets) the invented demo brand and its demo student, so coaches can show the student side with realistic data. */
export async function seedDemoBrand() {
  return run(async () => {
    const r = await adminApi<{ email: string; password: string; name: string }>({ action: "seed-demo" });
    return { ok: true, email: r.email, password: r.password, note: `${r.name} is ready. Sign in as the demo student with these details, or pick it in the brand switcher.` };
  });
}

export async function resetLink(email: string) {
  return run(async () => {
    const r = await adminApi<{ token_hash: string; type: string }>({ action: "reset", email });
    return { ok: true, link: setPasswordLink(await origin(), r.token_hash, r.type) };
  });
}

export async function removeStudent(tenantId: string, userId: string) {
  return run(async () => {
    await adminApi({ action: "remove", tenantId, userId });
    return { ok: true };
  });
}
