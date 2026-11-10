"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/data";
import { pcConfigured } from "@/lib/pc/client";
import * as M from "@/lib/pc/mutations";
import { draftAgenda } from "@/lib/pc/ai";
import { student, studentContext } from "@/lib/pc/queries";
import { provisionStudent } from "@/lib/pc/provision";
import { supabaseAdmin } from "@/lib/supabase/server";

type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>, refresh = true): Promise<R<T>> {
  await requireCoach();
  if (!pcConfigured()) return { ok: false, error: "Coaching data is not connected yet." };
  try {
    const data = await fn();
    if (refresh) revalidatePath("/admin", "layout");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function saveStudent(id: string, patch: { status?: string; lead_founder?: string; booking_url?: string; notes?: string }) {
  return run(() => M.updateStudent(id, patch as Parameters<typeof M.updateStudent>[1]));
}
export async function markPaid(id: string) {
  return run(async () => { await M.activateStudent(id); });
}
export async function resendWelcome(id: string) {
  return run(async () => { const s = await student(id); if (!s) throw new Error("No such student."); await M.welcome(s); });
}
export async function resetIntake(id: string) {
  return run(() => M.resetIntake(id, "coach"));
}
export async function sendCheckin(id: string) {
  return run(() => M.sendCheckinFor(id));
}
export async function addStudent(input: { first_name: string; last_name: string; email: string; company_name?: string }) {
  return run(() => M.addStudent(input));
}

export async function addActionItem(studentId: string, input: { owner: "student" | "founder"; text: string; due_on?: string | null }) {
  return run(() => M.addActionItem(studentId, input));
}
export async function updateActionItem(id: string, patch: { status?: "open" | "done" | "dropped"; text?: string; due_on?: string | null; owner?: "student" | "founder" }) {
  return run(() => M.updateActionItem(id, patch));
}
export async function addInitiative(studentId: string, name: string) {
  return run(() => M.addInitiative(studentId, name));
}
export async function updateInitiative(id: string, patch: { status?: string; name?: string; last_update?: string }) {
  return run(() => M.updateInitiative(id, patch));
}
export async function logMetric(studentId: string, metric: string, value: string, asOf?: string) {
  return run(() => M.logMetric(studentId, metric, value, asOf));
}

export async function agenda(studentId: string) {
  return run(async () => draftAgenda(await studentContext(studentId)), false);
}
export async function addCall(studentId: string, input: { transcript: string; date?: string | null; recording_url?: string | null }) {
  return run(() => M.addManualCall(studentId, input));
}
export async function resummarizeCall(callId: string) {
  return run(() => M.resummarize(callId));
}
export async function assignCall(callId: string, studentId: string) {
  return run(() => M.assignCall(callId, studentId));
}
export async function importFireflies(meetingId: string) {
  return run(() => M.importFireflies(meetingId));
}

/** Pull in any new coaching calls from Fireflies now, rather than waiting for the nightly job. */
export async function syncCalls(studentId?: string) {
  return run(() => M.syncFireflies(studentId ? { studentId } : {}));
}

/** Create the student's brand + platform account now (normally the hourly job does this once paid + intake complete). */
export async function provisionNow(studentId: string) {
  return run(() => provisionStudent(studentId, { force: true }));
}

/** Attach an existing brand to a Private Circle student record (one brand per student). */
export async function linkTenant(tenantId: string, studentId: string) {
  return run(async () => {
    const { error } = await supabaseAdmin().from("tenants").update({ pc_student_id: studentId }).eq("id", tenantId);
    if (error) throw new Error(/unique|duplicate/i.test(error.message) ? "That student is already linked to another brand." : error.message);
  });
}
