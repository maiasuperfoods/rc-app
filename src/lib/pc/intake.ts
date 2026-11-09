// The intake questionnaire as the Private Circle app defines it (mirrored here for display only;
// the form itself still lives at the Private Circle app). Keep in sync with inner-circle-onboarding/lib/intake.js.

export interface IntakeColumn { key: string; label: string; numeric?: boolean; money?: boolean; options?: string[] }
export interface IntakeQuestion { id: string; label: string; type: string; optional?: boolean; columns?: IntakeColumn[] }
export interface IntakeSection { id: string; title: string; questions: IntakeQuestion[] }

export const INTAKE_SECTIONS: IntakeSection[] = [
  { id: "brand", title: "Brand basics", questions: [
    { id: "brand_name", label: "Brand name", type: "text" },
    { id: "store_url", label: "Store URL", type: "text" },
    { id: "markets", label: "Markets and share of sales", type: "rows", columns: [{ key: "country", label: "Country" }, { key: "share", label: "% of sales", numeric: true }] },
    { id: "year_started", label: "Year the brand started selling", type: "number" },
    { id: "niche", label: "Niche / category", type: "text" },
    { id: "sku_count", label: "Number of active SKUs", type: "number" },
    { id: "hero_products", label: "Hero products and offers", type: "rows", columns: [{ key: "sku", label: "Product / SKU" }, { key: "offer", label: "Offer" }, { key: "price", label: "Price (USD)", numeric: true, money: true }, { key: "aov", label: "AOV (USD)", numeric: true, money: true }] },
    { id: "platform", label: "Store platform", type: "select" },
  ] },
  { id: "numbers", title: "Numbers", questions: [
    { id: "revenue_30d", label: "Revenue, last 30 days (USD)", type: "money" },
    { id: "revenue_12m", label: "Revenue, last 12 months (USD)", type: "money" },
    { id: "ad_spend_30d", label: "Total ad spend, last 30 days (USD)", type: "money" },
    { id: "gross_margin_pct", label: "Gross margin after COGS + shipping (%)", type: "percent" },
    { id: "net_margin_pct", label: "Net profit margin (%)", type: "percent" },
    { id: "aov", label: "Average order value (USD)", type: "money" },
    { id: "cac", label: "Customer acquisition cost (USD)", type: "money" },
    { id: "refund_rate_pct", label: "Refund / chargeback rate (%)", type: "percent" },
    { id: "cash_on_hand", label: "Cash available in the business (USD)", type: "money" },
    { id: "runway_months", label: "Months of runway", type: "number" },
  ] },
  { id: "acquisition", title: "Acquisition & creative", questions: [
    { id: "channels", label: "Paid channels in use", type: "multiselect" },
    { id: "spend_split", label: "Rough spend split by channel", type: "text" },
    { id: "creative_who", label: "Who makes your ad creative?", type: "select" },
    { id: "new_ads_per_week", label: "New ads launched per week", type: "number" },
    { id: "best_offer", label: "Best-performing offer right now", type: "textarea" },
    { id: "landing_pages", label: "Top landing pages", type: "rows", columns: [{ key: "page", label: "Page name or URL" }, { key: "type", label: "Type" }, { key: "share", label: "% of traffic", numeric: true }] },
    { id: "retention_setup", label: "Email / SMS and subscription setup", type: "textarea" },
  ] },
  { id: "operations", title: "Operations & tools", questions: [
    { id: "supplier", label: "Main supplier and country", type: "text" },
    { id: "fulfillment", label: "Fulfilment", type: "select" },
    { id: "lead_time_days", label: "Production + shipping lead time (days)", type: "number" },
    { id: "moq_units", label: "Minimum order quantity (units)", type: "number" },
    { id: "po_size", label: "Typical purchase order size (USD)", type: "money" },
    { id: "processor", label: "Payment processor(s)", type: "text" },
  ] },
  { id: "team", title: "Team", questions: [
    { id: "team", label: "Full-time team, including agencies on retainer", type: "rows", optional: true, columns: [{ key: "role", label: "Role" }, { key: "name", label: "Name / agency" }, { key: "salary", label: "Monthly cost (USD)", numeric: true, money: true }] },
    { id: "team_other", label: "Everyone else: part-time contractors, freelancers, one-off help", type: "textarea", optional: true },
    { id: "founder_hours", label: "Hours per week you personally spend on the business", type: "number" },
    { id: "founder_tasks", label: "What takes most of your time?", type: "textarea" },
    { id: "offload", label: "What do you want off your plate first?", type: "textarea" },
  ] },
  { id: "goals", title: "Goals & blockers", questions: [
    { id: "goal_90d", label: "90-day revenue target (USD / month)", type: "money" },
    { id: "goal_12m", label: "12-month revenue target (USD / month)", type: "money" },
    { id: "bottleneck", label: "The single biggest bottleneck right now", type: "textarea" },
    { id: "tried", label: "What you've already tried to fix it", type: "textarea" },
    { id: "want_from_circle", label: "What you want from the Private Circle", type: "textarea" },
  ] },
];

/** Renders an intake answer the way the desk did: rows become "a · b · c | a · b · c". */
export function intakeValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? Object.values(x as Record<string, unknown>).filter((y) => String(y ?? "").trim()).join(" · ") : String(x))).join("  |  ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export type IntakeRows = Record<string, string>[];
export const intakeRows = (v: unknown): IntakeRows => (Array.isArray(v) ? (v.filter((r) => r && typeof r === "object") as IntakeRows) : []);
