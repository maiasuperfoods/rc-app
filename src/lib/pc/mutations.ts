// Writes to the coaching records. Ported from the Private Circle desk/platform so both apps behave the same.
import { pc, pcLog, PC_BASE } from "./client";
import { extractCall } from "./ai";
import { studentContext } from "./queries";
import { sendCheckin, sendWelcome } from "./email";
import { KNOWN_METRICS, num, type PcCall, type PcStudent } from "./types";

const FOUNDER_DOMAINS = () => (process.env.FOUNDER_DOMAINS || "renaissancecommerce.com").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
export const isFounderEmail = (e: string | null | undefined) => FOUNDER_DOMAINS().some((d) => String(e ?? "").toLowerCase().endsWith("@" + d));

// ---------- students ----------
export async function updateStudent(id: string, patch: Partial<Pick<PcStudent, "status" | "lead_founder" | "booking_url" | "notes">>) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["status", "lead_founder", "booking_url", "notes"] as const) if (k in patch) row[k] = patch[k] || null;
  const { error } = await pc().from("pc_students").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addStudent(input: { first_name: string; last_name: string; email: string; company_name?: string }) {
  const { data, error } = await pc().from("pc_students").insert({ first_name: input.first_name, last_name: input.last_name || "", email: input.email.toLowerCase(), company_name: input.company_name || null, is_company: Boolean(input.company_name), status: "signed" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Mark paid (status active) and send the welcome email with intake + booking links. Mirrors activateStudent. */
export async function activateStudent(id: string) {
  const { data: s } = await pc().from("pc_students").select("*").eq("id", id).single();
  if (!s) throw new Error("No such student.");
  const student = s as PcStudent;
  const booking = student.booking_url || (process.env.CAL_BOOKING_URL ? `${process.env.CAL_BOOKING_URL}?email=${encodeURIComponent(student.email)}&name=${encodeURIComponent(student.first_name + " " + student.last_name)}` : null);
  const patch = { status: "active", paid_at: student.paid_at || new Date().toISOString(), updated_at: new Date().toISOString(), booking_url: booking };
  const { data } = await pc().from("pc_students").update(patch).eq("id", id).select().single();
  await pcLog("student.activated", { by: "rc-app" }, id);
  if (!student.paid_at) await welcome(data as PcStudent);
  return data as PcStudent;
}

export async function welcome(student: PcStudent) {
  try {
    await sendWelcome({ firstName: student.first_name, email: student.email, intakeUrl: `${PC_BASE()}/intake/${student.intake_token}`, bookingUrl: student.booking_url });
    await pcLog("email.welcome.sent", { by: "rc-app" }, student.id);
  } catch (e) {
    await pcLog("email.welcome.failed", { error: (e as Error).message }, student.id);
    throw e;
  }
}

export async function resetIntake(studentId: string, by: string) {
  const sb = pc();
  await sb.from("pc_intake").delete().eq("student_id", studentId);
  await sb.from("pc_metrics").delete().eq("student_id", studentId).eq("source", "intake");
  await sb.from("pc_students").update({ intake_status: "not_started", intake_completed_at: null, updated_at: new Date().toISOString() }).eq("id", studentId);
  await pcLog("intake.reset", { by }, studentId);
}

export async function sendCheckinFor(studentId: string) {
  const sb = pc();
  const { data: student } = await sb.from("pc_students").select("*").eq("id", studentId).single();
  const { data: ck, error } = await sb.from("pc_checkins").insert({ student_id: studentId }).select().single();
  if (error) throw new Error(error.message);
  await sendCheckin({ firstName: student.first_name, email: student.email, url: `${PC_BASE()}/checkin/${ck.token}` });
  await pcLog("checkin.sent", { checkin: ck.id, by: "rc-app" }, studentId);
}

// ---------- action items, initiatives, metrics ----------
export async function addActionItem(studentId: string, input: { owner: "student" | "founder"; text: string; due_on?: string | null }) {
  const { error } = await pc().from("pc_action_items").insert({ student_id: studentId, owner: input.owner, text: input.text, due_on: input.due_on || null });
  if (error) throw new Error(error.message);
}
export async function updateActionItem(id: string, patch: { status?: "open" | "done" | "dropped"; text?: string; due_on?: string | null; owner?: "student" | "founder" }) {
  const row: Record<string, unknown> = {};
  if (patch.status) { row.status = patch.status; row.done_at = patch.status === "done" ? new Date().toISOString() : null; }
  if (typeof patch.text === "string" && patch.text.trim()) row.text = patch.text.trim();
  if ("due_on" in patch) row.due_on = patch.due_on || null;
  if (patch.owner === "student" || patch.owner === "founder") row.owner = patch.owner;
  const { error } = await pc().from("pc_action_items").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function addInitiative(studentId: string, name: string, status = "planned") {
  const { count } = await pc().from("pc_initiatives").select("id", { count: "exact", head: true }).eq("student_id", studentId);
  const { error } = await pc().from("pc_initiatives").insert({ student_id: studentId, name, status, sort: count ?? 0 });
  if (error) throw new Error(error.message);
}
export async function updateInitiative(id: string, patch: { status?: string; name?: string; last_update?: string; target_metric?: string | null }) {
  const { error } = await pc().from("pc_initiatives").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function logMetric(studentId: string, metric: string, value: unknown, asOf?: string) {
  const v = num(value);
  if (v === null || !metric) throw new Error("Metric and numeric value required.");
  const { error } = await pc().from("pc_metrics").insert({ student_id: studentId, metric, label: KNOWN_METRICS[metric]?.[0] ?? metric, unit: KNOWN_METRICS[metric]?.[1] ?? "number", value: v, as_of: asOf || new Date().toISOString().slice(0, 10), source: "manual" });
  if (error) throw new Error(error.message);
}

// ---------- calls ----------
export async function addManualCall(studentId: string, input: { transcript: string; date?: string | null; recording_url?: string | null }) {
  const when = input.date ? new Date(input.date).toISOString() : new Date().toISOString();
  const { data, error } = await pc().from("pc_calls").insert({ student_id: studentId, status: "completed", kind: "weekly", source: "manual", external_id: crypto.randomUUID(), scheduled_at: when, ended_at: when, recording_url: input.recording_url || null, transcript: input.transcript, brief_update_status: "pending" }).select("id").single();
  if (error) throw new Error(error.message);
  await processCall(studentId, data.id);
  return data.id as string;
}

export async function resummarize(callId: string) {
  const { data: c } = await pc().from("pc_calls").select("id,student_id").eq("id", callId).single();
  if (!c?.student_id) throw new Error("Assign the call to a student first.");
  await pc().from("pc_action_items").delete().eq("source_call_id", c.id).eq("status", "open");
  await processCall(c.student_id, c.id);
}

export async function assignCall(callId: string, studentId: string) {
  const sb = pc();
  const { data: c } = await sb.from("pc_calls").select("*").eq("id", callId).single();
  if (!c) throw new Error("Call not found.");
  if (c.student_id && c.student_id !== studentId) return reassignCall(callId, studentId, c.attendee_emails ?? []);
  const { data: s } = await sb.from("pc_students").select("id,email,alt_emails").eq("id", studentId).single();
  if (!s) throw new Error("No such student.");
  const extra = ((c.attendee_emails ?? []) as string[]).map((e) => e.toLowerCase()).filter((e) => e !== s.email && !(s.alt_emails ?? []).includes(e) && !isFounderEmail(e));
  if (extra.length) await sb.from("pc_students").update({ alt_emails: [...(s.alt_emails ?? []), ...extra] }).eq("id", s.id);
  await sb.from("pc_calls").update({ student_id: s.id }).eq("id", c.id);
  if (c.transcript) await processCall(s.id, c.id);
}

export async function reassignCall(callId: string, newStudentId: string, extraAliasEmails: string[] = []) {
  const sb = pc();
  const { data: c } = await sb.from("pc_calls").select("*").eq("id", callId).single();
  if (!c) throw new Error("Call not found.");
  await sb.from("pc_action_items").delete().eq("source_call_id", callId);
  await sb.from("pc_metrics").delete().or(`call_id.eq.${callId},source.eq.call:${callId}`);
  await sb.from("pc_initiatives").delete().eq("started_call_id", callId);
  await sb.from("pc_initiatives").update({ last_call_id: null }).eq("last_call_id", callId);
  const farApart = c.scheduled_at && c.ended_at && Math.abs(+new Date(c.scheduled_at) - +new Date(c.ended_at)) > 6 * 3600e3;
  await sb.from("pc_calls").update({ student_id: newStudentId, kind: "weekly", scheduled_at: farApart ? c.ended_at : c.scheduled_at, summary: null, what_changed: null, decisions: [], blockers: [], open_questions: [], processed_at: null }).eq("id", callId);
  if (extraAliasEmails.length) {
    const { data: st } = await sb.from("pc_students").select("email,alt_emails").eq("id", newStudentId).single();
    if (!st) throw new Error("No such student.");
    const extra = extraAliasEmails.map((e) => e.toLowerCase()).filter((e) => e !== st.email && !(st.alt_emails ?? []).includes(e) && !isFounderEmail(e));
    if (extra.length) await sb.from("pc_students").update({ alt_emails: [...(st.alt_emails ?? []), ...extra] }).eq("id", newStudentId);
  }
  await pcLog("call.reassigned", { callId, from: c.student_id, by: "rc-app" }, newStudentId);
  if (c.transcript) await processCall(newStudentId, callId);
}

export async function importFireflies(meetingId: string) {
  const key = process.env.FIREFLIES_API_KEY;
  if (!key) throw new Error("FIREFLIES_API_KEY is not configured.");
  const q = `query T($id: String!) { transcript(id: $id) { id title date duration audio_url video_url participants summary { overview } sentences { speaker_name text } } }`;
  const r = await fetch("https://api.fireflies.ai/graphql", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q, variables: { id: meetingId } }), signal: AbortSignal.timeout(30000) });
  const j = (await r.json()) as { data?: { transcript?: Record<string, unknown> }; errors?: unknown };
  const t = j.data?.transcript as { id: string; title: string | null; date: number | null; duration: number | null; audio_url: string | null; video_url: string | null; participants: string[] | null; summary: { overview?: string } | null; sentences: { speaker_name: string; text: string }[] | null } | undefined;
  if (!t) throw new Error(`Fireflies: ${JSON.stringify(j.errors ?? j)}`);
  const call = {
    source: "fireflies", external_id: t.id, title: t.title, attendee_emails: t.participants ?? [],
    recording_url: t.video_url || t.audio_url || `https://app.fireflies.ai/view/${t.id}`,
    transcript: (t.sentences ?? []).map((s) => `${s.speaker_name}: ${s.text}`).join("\n"),
    summary: t.summary?.overview ?? null,
    started_at: t.date ? new Date(t.date) : null,
    ended_at: t.date ? new Date(t.date + (t.duration ?? 0) * 60000) : null,
  };
  const res = await ingestCall(call);
  await pcLog("call.fireflies.imported", { meetingId, ...res, by: "rc-app" });
  return res;
}

async function findStudentByEmails(emails: string[]) {
  const list = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()).filter((e) => !isFounderEmail(e)))];
  if (!list.length) return null;
  const { data } = await pc().from("pc_students").select("*").in("email", list).limit(1);
  if (data?.[0]) return data[0] as PcStudent;
  const { data: alt } = await pc().from("pc_students").select("*").overlaps("alt_emails", list).limit(1);
  return (alt?.[0] as PcStudent) ?? null;
}

async function ingestCall(call: { source: string; external_id: string; title: string | null; attendee_emails: string[]; recording_url: string | null; transcript: string; summary: string | null; started_at: Date | null; ended_at: Date | null }) {
  const sb = pc();
  let student = await findStudentByEmails(call.attendee_emails);
  let existing: { id: string } | null = null;
  if (!student) {
    const end = call.ended_at ?? new Date();
    const start = call.started_at ?? new Date(end.getTime() - 3600e3);
    const { data: sameDay } = await sb.from("pc_calls").select("id,student_id").eq("status", "scheduled").is("transcript", null).not("student_id", "is", null).gte("scheduled_at", new Date(start.getTime() - 1800e3).toISOString()).lte("scheduled_at", end.toISOString());
    if (sameDay?.length === 1) { const { data: st } = await sb.from("pc_students").select("*").eq("id", sameDay[0].student_id).single(); student = st as PcStudent; existing = { id: sameDay[0].id }; }
  }
  if (student && !existing) {
    const t = call.ended_at ?? new Date();
    const { data } = await sb.from("pc_calls").select("id").eq("student_id", student.id).eq("status", "scheduled").gte("scheduled_at", new Date(t.getTime() - 4 * 3600e3).toISOString()).lte("scheduled_at", new Date(t.getTime() + 3600e3).toISOString()).limit(1);
    existing = data?.[0] ?? null;
  }
  const patch = { student_id: student?.id ?? null, status: "completed", ended_at: (call.ended_at ?? new Date()).toISOString(), title: call.title, attendee_emails: call.attendee_emails, recording_url: call.recording_url, transcript: call.transcript, summary: call.summary, brief_update_status: "none" };
  let callId: string;
  if (existing) { await sb.from("pc_calls").update({ ...patch, source: call.source, external_id: call.external_id }).eq("id", existing.id); callId = existing.id; }
  else {
    const { data, error } = await sb.from("pc_calls").upsert({ ...patch, source: call.source, external_id: call.external_id, kind: student && !student.intake_completed_at ? "discovery" : "weekly" }, { onConflict: "source,external_id" }).select("id").single();
    if (error) throw new Error(error.message);
    callId = data.id;
  }
  await pcLog("call.transcript.received", { source: call.source, matched: Boolean(student), attendees: call.attendee_emails, by: "rc-app" }, student?.id ?? null);
  if (student) await processCall(student.id, callId);
  return { matched: Boolean(student), callId };
}

/** Transcript → summary, numbers, initiatives, commitments. Same contract as the Private Circle app's processCall. */
export async function processCall(studentId: string, callId: string) {
  const sb = pc();
  try {
    const { data: call } = await sb.from("pc_calls").select("*").eq("id", callId).single();
    if (!call?.transcript) return;
    const ctx = await studentContext(studentId);
    const out = await extractCall({ student: ctx.student, call: call as PcCall, context: ctx });
    const asOf = new Date(call.ended_at || call.scheduled_at || call.created_at || Date.now()).toISOString().slice(0, 10);
    await sb.from("pc_calls").update({ summary: out.summary, what_changed: out.what_changed, decisions: out.decisions ?? [], blockers: out.blockers ?? [], open_questions: out.open_questions ?? [], extraction: out, processed_at: new Date().toISOString(), brief_update_status: "reviewed" }).eq("id", callId);
    const rows = (out.numbers ?? []).filter((n) => typeof n.value === "number" && n.metric).map((n) => {
      const k = String(n.metric).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
      return { student_id: studentId, as_of: asOf, metric: k, label: KNOWN_METRICS[k]?.[0] ?? n.label ?? k, unit: KNOWN_METRICS[k]?.[1] ?? n.unit ?? "number", value: n.value, quote: n.quote ?? null, source: `call:${callId}`, call_id: callId };
    });
    if (rows.length) await sb.from("pc_metrics").insert(rows);
    const existingIds = new Set(ctx.initiatives.map((i) => i.id));
    let sort = ctx.initiatives.length;
    for (const i of out.initiatives ?? []) {
      if (i.id && existingIds.has(i.id)) {
        await sb.from("pc_initiatives").update({ status: i.status, last_update: i.update, last_call_id: callId, target_metric: i.target_metric ?? undefined, updated_at: new Date().toISOString() }).eq("id", i.id);
      } else if (i.name) {
        const dup = ctx.initiatives.find((e) => e.name.toLowerCase() === i.name.toLowerCase());
        if (dup) await sb.from("pc_initiatives").update({ status: i.status, last_update: i.update, last_call_id: callId, updated_at: new Date().toISOString() }).eq("id", dup.id);
        else await sb.from("pc_initiatives").insert({ student_id: studentId, name: i.name, status: i.status, last_update: i.update, target_metric: i.target_metric ?? null, started_call_id: callId, last_call_id: callId, sort: sort++ });
      }
    }
    const items = (out.commitments ?? []).map((a) => ({ student_id: studentId, source_call_id: callId, owner: a.owner, text: a.text, due_on: a.due_days ? new Date(Date.now() + a.due_days * 86400e3).toISOString().slice(0, 10) : null }));
    if (items.length) await sb.from("pc_action_items").insert(items);
    await pcLog("call.processed", { callId, numbers: rows.length, initiatives: (out.initiatives ?? []).length, commitments: items.length, by: "rc-app" }, studentId);
  } catch (e) {
    await pcLog("call.extraction.failed", { error: (e as Error).message, callId, by: "rc-app" }, studentId);
    throw e;
  }
}
