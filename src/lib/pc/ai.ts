// Per-call extraction and pre-call agenda, ported from the Private Circle desk (lib/calls-ai.js).
import { KNOWN_METRICS, type PcCall, type PcStudent } from "./types";
import type { StudentContext } from "./queries";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

export interface Extraction {
  what_changed: string;
  summary: string;
  numbers: { metric: string; label: string; unit: "usd" | "pct" | "number" | "months"; value: number; quote: string }[];
  initiatives: { id: string | null; name: string; status: "planned" | "in_progress" | "done" | "parked"; update: string; target_metric: string | null }[];
  commitments: { owner: "student" | "founder"; text: string; due_days: number | null }[];
  decisions: string[];
  blockers: string[];
  open_questions: string[];
}

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["what_changed", "summary", "numbers", "initiatives", "commitments", "decisions", "blockers", "open_questions"],
  properties: {
    what_changed: { type: "string", description: "2–4 sentences: what is different about this student's situation compared with the previous state. Lead with the most important change. If nothing material changed, say so in one sentence." },
    summary: { type: "string", description: "4–7 sentences on what the call covered and concluded. Concrete, numeric, no filler." },
    numbers: { type: "array", description: "Every figure the student stated about their business. Use a known metric key where one fits; otherwise invent a short snake_case key and a label.", items: { type: "object", additionalProperties: false, required: ["metric", "label", "unit", "value", "quote"], properties: {
      metric: { type: "string" }, label: { type: "string" }, unit: { type: "string", enum: ["usd", "pct", "number", "months"] }, value: { type: "number" }, quote: { type: "string", description: "Verbatim words from the transcript that state the figure." } } } },
    initiatives: { type: "array", description: "The levers being worked on that this call touched. Reuse an existing initiative id when the call is about the same thing; create a new one only for genuinely new work.", items: { type: "object", additionalProperties: false, required: ["id", "name", "status", "update", "target_metric"], properties: {
      id: { type: ["string", "null"] }, name: { type: "string", description: "Short name, max 6 words" }, status: { type: "string", enum: ["planned", "in_progress", "done", "parked"] }, update: { type: "string" }, target_metric: { type: ["string", "null"] } } } },
    commitments: { type: "array", items: { type: "object", additionalProperties: false, required: ["owner", "text", "due_days"], properties: { owner: { type: "string", enum: ["student", "founder"] }, text: { type: "string" }, due_days: { type: ["number", "null"] } } } },
    decisions: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
  },
};

async function structured<T>({ system, user, schema, maxTokens = 4000 }: { system: string; user: string; schema: unknown; maxTokens?: number }): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const headers = { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" };
  const send = async (body: Record<string, unknown>) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, ...body }), signal: AbortSignal.timeout(120000) });
    return { ok: r.ok, status: r.status, json: (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string; input?: unknown }[]; error?: { message?: string } } };
  };
  const tools = [{ name: "emit", description: "Return the result in the required structure.", input_schema: schema }];
  const attempts = [
    { system, messages: [{ role: "user", content: user }], tools, tool_choice: { type: "tool", name: "emit" } },
    { system: system + "\nRespond with ONLY a JSON object that matches this JSON Schema, no prose, no code fences:\n" + JSON.stringify(schema), messages: [{ role: "user", content: user }] },
  ];
  let lastErr: Error | null = null;
  for (const body of attempts) {
    const r = await send(body);
    if (!r.ok) { lastErr = new Error(`Claude ${r.status}: ${r.json?.error?.message ?? ""}`); if (r.status === 400 && /tool/i.test(lastErr.message)) continue; throw lastErr; }
    const tool = (r.json.content ?? []).find((c) => c.type === "tool_use");
    if (tool) return tool.input as T;
    const text = (r.json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as T; } catch { lastErr = new Error("Claude returned invalid JSON"); } }
    lastErr = lastErr ?? new Error("Claude returned no structured output");
  }
  throw lastErr;
}

export async function extractCall({ student, call, context }: { student: PcStudent; call: PcCall; context: StudentContext }): Promise<Extraction> {
  const system = `You maintain the progress record for a student of Renaissance Commerce's Private Circle: a 1-on-1 coaching program for e-commerce founders, weekly 45-minute calls with the founders, aimed at a 90-day revenue target. Audience: the coaches, reading before the next call.
Rules: be concrete and numeric; never invent figures — only list numbers the student actually stated, with the verbatim quote; reuse existing initiative ids whenever the call is about the same work; keep every line short. Plain language, no hype.`;
  const user = `Student: ${student.first_name} ${student.last_name}${student.company_name ? ` (${student.company_name})` : ""}.
Call: ${call.kind} on ${call.scheduled_at || call.ended_at || call.created_at}${call.title ? ` — ${call.title}` : ""}.

# Current state before this call
## 90-day target: ${context.goal || "unknown"}
## Latest known numbers
${context.numbers.length ? context.numbers.map((n) => `- ${n.label || n.metric}: ${n.value} (${n.as_of}${n.source ? `, ${n.source}` : ""})`).join("\n") : "(none)"}
## Initiatives
${context.initiatives.length ? context.initiatives.map((i) => `- id ${i.id} · ${i.name} · ${i.status}${i.last_update ? ` · ${i.last_update}` : ""}`).join("\n") : "(none yet)"}
## Open commitments
${context.commitments.length ? context.commitments.map((c) => `- [${c.owner}] ${c.text}${c.due_on ? ` (due ${c.due_on})` : ""}`).join("\n") : "(none)"}
## Previous call summary
${context.previousSummary || "(this is the first call)"}

# Transcript
${(call.transcript || "").slice(0, 110000)}

Extract the structured update for this call.`;
  return structured<Extraction>({ system, user, schema: SCHEMA, maxTokens: 4000 });
}

export async function draftAgenda(context: StudentContext): Promise<string[]> {
  const schema = { type: "object", additionalProperties: false, required: ["agenda"], properties: { agenda: { type: "array", items: { type: "string" }, description: "4–7 agenda points for the next call, most important first, each one line." } } };
  const user = `Student: ${context.student.first_name} ${context.student.last_name}. 90-day target: ${context.goal || "unknown"}.
Latest numbers: ${context.numbers.map((n) => `${n.label || n.metric} ${n.value}`).join(", ") || "none"}.
Initiatives: ${context.initiatives.map((i) => `${i.name} (${i.status}${i.last_update ? `: ${i.last_update}` : ""})`).join("; ") || "none"}.
Overdue or open commitments: ${context.commitments.map((c) => `[${c.owner}] ${c.text}`).join("; ") || "none"}.
Open questions from last call: ${context.openQuestions.join("; ") || "none"}.
Blockers: ${context.blockers.join("; ") || "none"}.
Last call: ${context.previousSummary || "none"}.
Draft the agenda for the next weekly call.`;
  const out = await structured<{ agenda: string[] }>({ system: "You prepare the coaches of a 1-on-1 e-commerce coaching program for their next weekly call. Be specific to this student; no generic advice.", user, schema, maxTokens: 800 });
  return out?.agenda ?? [];
}

export const metricMeta = (k: string, fallback?: { label?: string | null; unit?: string | null }) => ({
  label: KNOWN_METRICS[k]?.[0] ?? fallback?.label ?? k,
  unit: (KNOWN_METRICS[k]?.[1] ?? fallback?.unit ?? "number") as "usd" | "pct" | "number" | "months",
});
