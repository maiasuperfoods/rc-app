import { pc, pcSignedUrl } from "./client";
import type { PcActionItem, PcCall, PcCheckin, PcEvent, PcFile, PcInitiative, PcIntake, PcMetric, PcStudent, RosterRow, StudentBundle } from "./types";

const NONE = "00000000-0000-0000-0000-000000000000";

/** Every student with their call cadence and open commitments: the All students table. */
export async function roster(): Promise<RosterRow[]> {
  const sb = pc();
  const { data: students } = await sb.from("pc_students").select("*").order("created_at", { ascending: false });
  const ids = (students ?? []).map((s) => s.id);
  const [{ data: calls }, { data: actions }] = await Promise.all([
    sb.from("pc_calls").select("student_id,scheduled_at,status,ended_at").in("student_id", ids.length ? ids : [NONE]),
    sb.from("pc_action_items").select("student_id,due_on").eq("status", "open"),
  ]);
  const now = Date.now();
  return ((students ?? []) as PcStudent[]).map((s) => {
    const cs = (calls ?? []).filter((c) => c.student_id === s.id);
    const last = cs.filter((c) => c.status === "completed").sort((a, b) => +new Date(b.ended_at || b.scheduled_at) - +new Date(a.ended_at || a.scheduled_at))[0];
    const next = cs.filter((c) => c.status === "scheduled" && +new Date(c.scheduled_at) > now).sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
    const mine = (actions ?? []).filter((a) => a.student_id === s.id);
    return { ...s, lastCall: last?.ended_at || last?.scheduled_at || null, nextCall: next?.scheduled_at || null, openActions: mine.length, overdueActions: mine.filter((a) => a.due_on && +new Date(a.due_on) < now).length };
  });
}

export async function student(id: string): Promise<PcStudent | null> {
  const { data } = await pc().from("pc_students").select("*").eq("id", id).maybeSingle();
  return (data as PcStudent) ?? null;
}

export async function studentByEmail(email: string): Promise<PcStudent | null> {
  const e = email.toLowerCase();
  const { data } = await pc().from("pc_students").select("*").eq("email", e).maybeSingle();
  if (data) return data as PcStudent;
  const { data: alt } = await pc().from("pc_students").select("*").contains("alt_emails", [e]).limit(1);
  return (alt?.[0] as PcStudent) ?? null;
}

export async function bundle(id: string): Promise<StudentBundle | null> {
  const sb = pc();
  const s = await student(id);
  if (!s) return null;
  const [calls, intake, files, actions, metrics, initiatives, checkins] = await Promise.all([
    sb.from("pc_calls").select("*").eq("student_id", id).order("scheduled_at", { ascending: false }),
    sb.from("pc_intake").select("*").eq("student_id", id).maybeSingle(),
    sb.from("pc_files").select("*").eq("student_id", id).order("created_at", { ascending: false }),
    sb.from("pc_action_items").select("*").eq("student_id", id).order("status").order("due_on"),
    sb.from("pc_metrics").select("*").eq("student_id", id).order("as_of").order("created_at"),
    sb.from("pc_initiatives").select("*").eq("student_id", id).order("sort"),
    sb.from("pc_checkins").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(5),
  ]);
  return {
    student: s,
    intake: (intake.data as PcIntake) ?? null,
    calls: (calls.data ?? []) as PcCall[],
    actions: (actions.data ?? []) as PcActionItem[],
    metrics: (metrics.data ?? []).map((m) => ({ ...m, value: Number(m.value) })) as PcMetric[],
    initiatives: (initiatives.data ?? []) as PcInitiative[],
    checkins: (checkins.data ?? []) as PcCheckin[],
    files: (files.data ?? []) as PcFile[],
    agreementUrl: await pcSignedUrl(s.agreement_pdf_path),
  };
}

export async function allCalls(limit = 100) {
  const sb = pc();
  const [{ data: calls }, { data: students }, { data: events }, { count: unassigned }] = await Promise.all([
    sb.from("pc_calls").select("*, pc_students(first_name,last_name)").order("created_at", { ascending: false }).limit(limit),
    sb.from("pc_students").select("id,first_name,last_name").order("first_name"),
    sb.from("pc_events").select("id,created_at,type,payload,student_id").or("type.like.cal.%,type.like.call.%,type.like.checkin.%,type.like.stripe.%").order("created_at", { ascending: false }).limit(25),
    sb.from("pc_calls").select("id", { count: "exact", head: true }).is("student_id", null),
  ]);
  return { calls: (calls ?? []) as PcCall[], students: (students ?? []) as Pick<PcStudent, "id" | "first_name" | "last_name">[], events: (events ?? []) as PcEvent[], unassigned: unassigned ?? 0 };
}

/** Context the AI prompts receive (mirrors the desk's studentContext). */
export async function studentContext(studentId: string) {
  const sb = pc();
  const [{ data: st }, { data: intake }, { data: metrics }, { data: initiatives }, { data: commitments }, { data: calls }] = await Promise.all([
    sb.from("pc_students").select("*").eq("id", studentId).single(),
    sb.from("pc_intake").select("answers").eq("student_id", studentId).maybeSingle(),
    sb.from("pc_metrics").select("*").eq("student_id", studentId).order("as_of"),
    sb.from("pc_initiatives").select("*").eq("student_id", studentId).order("sort"),
    sb.from("pc_action_items").select("*").eq("student_id", studentId).eq("status", "open").order("due_on"),
    sb.from("pc_calls").select("id,summary,open_questions,blockers,ended_at,scheduled_at,status").eq("student_id", studentId).eq("status", "completed").not("processed_at", "is", null).order("ended_at", { ascending: false }).limit(1),
  ]);
  const latest: Record<string, PcMetric> = {};
  for (const m of (metrics ?? []) as PcMetric[]) latest[m.metric] = m;
  const g = Number(String(intake?.answers?.goal_90d ?? "").replace(/[,$%\s]/g, ""));
  const prev = calls?.[0];
  return {
    student: st as PcStudent,
    goal: Number.isFinite(g) && g > 0 ? `$${g.toLocaleString("en-US")}/mo` : null,
    numbers: Object.values(latest),
    initiatives: (initiatives ?? []) as PcInitiative[],
    commitments: (commitments ?? []) as PcActionItem[],
    previousSummary: (prev?.summary as string) || null,
    openQuestions: (prev?.open_questions as string[]) || [],
    blockers: (prev?.blockers as string[]) || [],
  };
}
export type StudentContext = Awaited<ReturnType<typeof studentContext>>;
