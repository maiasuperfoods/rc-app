// Shapes of the Private Circle tables in the admin project (snake_case, as stored).

export type PcStatus = "signed" | "active" | "paused" | "cancelled";
export type IntakeStatus = "not_started" | "in_progress" | "complete";

export interface PcStudent {
  id: string;
  created_at: string;
  updated_at: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_company: boolean;
  company_name: string | null;
  company_number: string | null;
  company_role: string | null;
  company_address: string | null;
  status: PcStatus;
  agreement_id: string | null;
  agreement_signed_at: string | null;
  agreement_pdf_path: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
  paid_at: string | null;
  intake_token: string | null;
  intake_status: IntakeStatus;
  intake_completed_at: string | null;
  booking_url: string | null;
  lead_founder: string | null;
  alt_emails: string[] | null;
  notes: string | null;
}

export interface PcCall {
  id: string;
  student_id: string | null;
  created_at: string;
  scheduled_at: string | null;
  ended_at: string | null;
  status: "scheduled" | "completed" | "cancelled" | string;
  kind: "discovery" | "weekly" | string;
  source: string | null;
  external_id: string | null;
  title: string | null;
  attendee_emails: string[] | null;
  meeting_url: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  what_changed: string | null;
  decisions: string[] | null;
  blockers: string[] | null;
  open_questions: string[] | null;
  processed_at: string | null;
  pc_students?: { first_name: string; last_name: string } | null;
}

export interface PcActionItem {
  id: string;
  student_id: string;
  created_at: string;
  source_call_id: string | null;
  owner: "student" | "founder";
  text: string;
  due_on: string | null;
  status: "open" | "done" | "dropped";
  done_at: string | null;
}

export interface PcMetric {
  id: string;
  student_id: string;
  as_of: string;
  metric: string;
  value: number;
  source: string | null;
  label: string | null;
  unit: string | null;
  quote: string | null;
  call_id: string | null;
  created_at: string;
}

export interface PcInitiative {
  id: string;
  student_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  status: "planned" | "in_progress" | "done" | "parked";
  target_metric: string | null;
  started_call_id: string | null;
  last_call_id: string | null;
  last_update: string | null;
  sort: number;
}

export interface PcCheckin {
  id: string;
  student_id: string;
  token: string;
  created_at: string;
  submitted_at: string | null;
  answers: Record<string, unknown> | null;
}

export interface PcFile {
  id: string;
  student_id: string;
  created_at: string;
  kind: string;
  label: string | null;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
}

export interface PcIntake {
  student_id: string;
  updated_at: string | null;
  answers: Record<string, unknown>;
  sections_complete: string[] | null;
}

export interface PcEvent {
  id: number;
  created_at: string;
  student_id: string | null;
  type: string;
  payload: Record<string, unknown> | null;
}

/** Everything the desk shows for one student, loaded in one go. */
export interface StudentBundle {
  student: PcStudent;
  intake: PcIntake | null;
  calls: PcCall[];
  actions: PcActionItem[];
  metrics: PcMetric[];
  initiatives: PcInitiative[];
  checkins: PcCheckin[];
  files: PcFile[];
  agreementUrl: string | null;
}

export interface RosterRow extends PcStudent {
  lastCall: string | null;
  nextCall: string | null;
  openActions: number;
  overdueActions: number;
}

export const KNOWN_METRICS: Record<string, [string, "usd" | "pct" | "number" | "months"]> = {
  revenue_30d: ["Revenue / 30d", "usd"],
  revenue_12m: ["Revenue / 12m", "usd"],
  ad_spend_30d: ["Ad spend / 30d", "usd"],
  gross_margin_pct: ["Gross margin", "pct"],
  net_margin_pct: ["Net margin", "pct"],
  aov: ["AOV", "usd"],
  cac: ["CAC", "usd"],
  cash_on_hand: ["Cash on hand", "usd"],
  runway_months: ["Runway (months)", "months"],
  refund_rate_pct: ["Refund rate", "pct"],
  roas: ["ROAS", "number"],
  mer: ["MER", "number"],
  new_ads_per_week: ["New ads / week", "number"],
  founder_hours: ["Founder hours / week", "number"],
};

export const num = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(/[,$%\s]/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};
