// When a Private Circle student has paid and completed the intake, give them a brand in the platform:
// tenant + student account + the parts of their setup the intake already answered. Idempotent per student.
import { supabaseAdmin } from "@/lib/supabase/server";
import { setPasswordLink } from "@/lib/admin-api";
import { defaultForecastInputs, mondayOnOrBefore } from "@/lib/calc/forecast";
import { pc, pcLog } from "./client";
import { intakeRows } from "./intake";
import { num, type PcStudent } from "./types";
import { sendPlatformAccess } from "./email";

const APP = () => (process.env.APP_URL || "https://app.renaissancecommerce.com").replace(/\/$/, "");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "item";

function stageFor(revenue30d: number | null): "grind" | "validation" | "acceleration" | "expansion" {
  if (revenue30d == null) return "grind";
  if (revenue30d < 10000) return "grind";
  if (revenue30d < 50000) return "validation";
  if (revenue30d < 250000) return "acceleration";
  return "expansion";
}

export interface ProvisionResult { tenantId: string; created: boolean; email: string; emailed: boolean; skipped?: string }

/** Students who should have a brand but don't yet. */
export async function dueForProvisioning(): Promise<PcStudent[]> {
  const { data: students } = await pc().from("pc_students").select("*").eq("status", "active").eq("intake_status", "complete");
  if (!students?.length) return [];
  const { data: linked } = await supabaseAdmin().from("tenants").select("pc_student_id").not("pc_student_id", "is", null);
  const have = new Set((linked ?? []).map((t) => t.pc_student_id as string));
  return (students as PcStudent[]).filter((s) => !have.has(s.id));
}

export async function provisionStudent(studentId: string, opts: { force?: boolean } = {}): Promise<ProvisionResult> {
  const sb = supabaseAdmin();
  const { data: s } = await pc().from("pc_students").select("*").eq("id", studentId).single();
  if (!s) throw new Error("No such student.");
  const student = s as PcStudent;
  if (!opts.force && !(student.status === "active" && student.intake_status === "complete")) {
    return { tenantId: "", created: false, email: student.email, emailed: false, skipped: "Not paid or intake not complete." };
  }
  const { data: intake } = await pc().from("pc_intake").select("answers").eq("student_id", studentId).maybeSingle();
  const a = (intake?.answers ?? {}) as Record<string, unknown>;

  // 1. Tenant (once per student)
  const { data: existing } = await sb.from("tenants").select("id").eq("pc_student_id", studentId).maybeSingle();
  let tenantId = existing?.id as string | undefined;
  let created = false;
  if (!tenantId) {
    const name = String(a.brand_name ?? "").trim() || student.company_name || `${student.first_name} ${student.last_name}`;
    const rawUrl = String(a.store_url ?? "").trim();
    const domain = rawUrl ? rawUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase() : null;
    const { data: t, error } = await sb.from("tenants").insert({ name, domain, stage: stageFor(num(a.revenue_30d)), tier: "ic", currency: "USD", onboarding_complete: true, pc_student_id: studentId }).select("id").single();
    if (error) throw new Error(error.message);
    tenantId = t.id;
    created = true;
    await seedFromIntake(tenantId!, a);
  }

  // 2. Student account + membership
  const email = student.email.toLowerCase();
  let user = await userByEmail(email);
  let tokenHash: string | null = null;
  let linkType = "invite";
  if (!user) {
    const { data, error } = await sb.auth.admin.generateLink({ type: "invite", email, options: { data: { name: `${student.first_name} ${student.last_name}` } } });
    if (error) throw new Error(error.message);
    user = data.user;
    tokenHash = data.properties.hashed_token;
    linkType = data.properties.verification_type ?? "invite";
  } else if (created) {
    const { data, error } = await sb.auth.admin.generateLink({ type: "recovery", email });
    if (error) throw new Error(error.message);
    tokenHash = data.properties.hashed_token;
    linkType = data.properties.verification_type ?? "recovery";
  }
  await sb.from("tenant_members").upsert({ tenant_id: tenantId, user_id: user!.id, role: "student" });
  if (created) await sb.from("invites").insert({ email, tenant_id: tenantId, role: "student", invited_by: null }).then(() => {}, () => {});

  // 3. Tell the student (only when something new was created)
  let emailed = false;
  if (tokenHash) {
    try {
      const { data: t } = await sb.from("tenants").select("name").eq("id", tenantId).single();
      await sendPlatformAccess({ firstName: student.first_name, email, brandName: t?.name ?? "Your brand", setPasswordUrl: setPasswordLink(APP(), tokenHash, linkType), appUrl: APP() });
      emailed = true;
      await pcLog("platform.access.sent", { tenantId }, studentId);
    } catch (e) {
      await pcLog("platform.access.email_failed", { tenantId, error: (e as Error).message }, studentId);
    }
  }
  if (created) await pcLog("platform.provisioned", { tenantId }, studentId);
  return { tenantId: tenantId!, created, email, emailed };
}

async function userByEmail(email: string) {
  const sb = supabaseAdmin();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Pre-fill what the intake already told us. Everything here is editable by the student afterwards. */
async function seedFromIntake(tenantId: string, a: Record<string, unknown>) {
  const sb = supabaseAdmin();
  const heroes = intakeRows(a.hero_products).filter((r) => String(r.sku ?? "").trim());
  const skuIds: string[] = [];
  for (const [i, h] of heroes.entries()) {
    const title = String(h.sku).trim();
    const pid = `${tenantId.slice(0, 8)}-p-${slug(title)}-${i}`;
    const sid = `${tenantId.slice(0, 8)}-s-${slug(title)}-${i}`;
    await sb.from("products").upsert({ id: pid, tenant_id: tenantId, title, shopify_product_id: null, active: true });
    await sb.from("skus").upsert({ id: sid, tenant_id: tenantId, product_id: pid, sku: slug(title).toUpperCase().slice(0, 16), variant_title: title, shopify_variant_id: null, landed_cost: 0, units_per_pack: 1 });
    skuIds.push(sid);
    const price = num(h.price);
    if (price) await sb.from("offers").insert({ tenant_id: tenantId, name: String(h.offer ?? "").trim() || `${title} · single`, price, sku_id: sid, units_shipped: 1, is_default: i === 0 });
  }
  const team = intakeRows(a.team).filter((r) => num(r.salary));
  if (team.length) await sb.from("opex_lines").insert(team.map((r) => ({ tenant_id: tenantId, name: [r.role, r.name].filter((x) => String(x ?? "").trim()).join(" — ") || "Team", monthly: num(r.salary)! })));
  const lead = num(a.lead_time_days), moq = num(a.moq_units);
  if (skuIds.length && (lead || moq || a.supplier)) await sb.from("suppliers").insert({ tenant_id: tenantId, sku_id: skuIds[0], name: String(a.supplier ?? "Main supplier").trim() || "Main supplier", lead_time_days: lead ?? 30, moq: moq ?? 0, payment_terms: null });
  const refund = num(a.refund_rate_pct);
  if (refund != null) await sb.from("cost_inputs").upsert({ tenant_id: tenantId, refund_rate: Math.min(1, refund / 100) });
  const spend = num(a.ad_spend_30d);
  if (spend) {
    const months: string[] = [];
    const d = new Date();
    for (let i = 1; i <= 3; i++) months.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
    await sb.from("spend_plans").upsert(months.map((month) => ({ tenant_id: tenantId, month, spend })));
  }
  const fc = defaultForecastInputs(mondayOnOrBefore(new Date().toISOString().slice(0, 10)).toISOString().slice(0, 10));
  const cash = num(a.cash_on_hand);
  if (cash != null) fc.cashOnHand = cash;
  if (spend) fc.lines[0].dailySpendStart = Math.round(spend / 30);
  const aov = num(a.aov);
  if (aov) fc.lines[0].firstOrderAov = aov;
  if (heroes[0]) fc.lines[0].name = String(heroes[0].sku).trim();
  if (team.length) fc.fixedOpexMonthly = team.reduce((s, r) => s + (num(r.salary) ?? 0), 0);
  await sb.from("forecast_inputs").upsert({ tenant_id: tenantId, data: fc });
}
