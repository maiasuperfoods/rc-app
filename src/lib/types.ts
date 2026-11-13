// Domain types shared by the UI, the data layer and the workers.
// Everything is scoped to a tenant (one tenant = one brand).

export type Stage = "grind" | "validation" | "acceleration" | "expansion";
export type Role = "student" | "coach" | "admin";
export type Tier = "ic" | "skool" | "trial";

export interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  stage: Stage;
  tier: Tier;
  currency: string;
  timezone: string;
  createdAt: string;
  onboardingComplete: boolean;
  /** Private Circle student id in the admin project, when this brand came from the coaching program. */
  pcStudentId: string | null;
}

export interface Membership {
  tenantId: string;
  userId: string;
  role: Role;
}

export interface Product {
  id: string;
  tenantId: string;
  title: string;
  shopifyProductId: string | null;
  active: boolean;
}

export interface Sku {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  variantTitle: string;
  shopifyVariantId: string | null;
  landedCost: number; // per unit, inbound shipping + duties + inspection included
  unitsPerPack: number;
}

/** Per-tenant cost assumptions used by the margin model. */
export interface CostInputs {
  tenantId: string;
  outboundShippingPerOrder: number;
  fulfillmentPerOrder: number; // 3PL pick/pack
  fulfillmentPerUnit: number; // packaging per unit
  processingRate: number; // 0.029
  processingFixed: number; // 0.30
  bufferRate: number; // 0.07 slippage buffer
  refundRate: number; // 0.04
  chargebackRate: number; // 0.004
  targetMarginRule: number; // 0.85 — the "85% rule" threshold on gross margin after COGS+fulfilment
}

export interface Offer {
  id: string;
  tenantId: string;
  name: string; // "Buy 2 Get 2"
  price: number;
  skuId: string;
  unitsShipped: number;
  isDefault: boolean;
}

export interface Upsell {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  cogs: number;
  takeRate: number; // 0.25
}

export interface OpexLine {
  id: string;
  tenantId: string;
  name: string;
  monthly: number;
}

export interface Supplier {
  id: string;
  tenantId: string;
  skuId: string;
  name: string;
  leadTimeDays: number;
  moq: number;
  paymentTerms: string;
}

export interface InventoryPosition {
  skuId: string;
  onHand: number;
  inbound: { quantity: number; eta: string; poNumber?: string }[];
  dailyVelocity30: number; // units/day, last 30 days
}

export interface SpendPlan {
  tenantId: string;
  months: { month: string; spend: number }[]; // "2026-12"
}

// ---- Brand Book --------------------------------------------------------

export interface Avatar {
  id: string;
  name: string; // "Keto Brenda"
  age: string;
  summary: string;
  painPoints: string[];
  desires: string[];
  objections: string[];
  positioning: string; // "We are the X for Y who want Z without W"
}

export interface AngleFamily {
  id: string;
  name: string;
  avatarId: string | null;
  headlines: string[];
  status: "untested" | "testing" | "winner" | "retired";
}

export interface ProofItem {
  id: string;
  type: "reviews" | "study" | "authority" | "before_after" | "press" | "other";
  label: string;
  detail: string;
}

export interface Objection {
  id: string;
  objection: string;
  answer: string;
}

export interface BrandBook {
  tenantId: string;
  version: number;
  updatedAt: string;
  category: "supplement" | "device" | "skincare" | "apparel" | "other";
  mechanism: string;
  avatars: Avatar[];
  angles: AngleFamily[];
  proof: ProofItem[];
  objections: Objection[];
  complianceRails: string[];
  adNamingConvention: string; // SOP: "[Angle] | [Awareness] | [Name] | [Type] | [Product] | [Strategist]"
  strategists: { code: string; name: string }[]; // code at the end of the ad name → display name
  creativeRules?: CreativeRules;
}

// ---- Ingested metrics --------------------------------------------------

/** One row per tenant per day, from Triple Whale (business truth). */
export interface DailyBusinessMetrics {
  tenantId: string;
  date: string;
  revenue: number;
  orders: number;
  newCustomers: number;
  returningCustomers: number;
  adSpend: number; // blended across channels
  /** First-order revenue from new customers, as Triple Whale reports it. Null when no source supplies it. */
  newCustomerRevenue?: number | null;
  refunds: number;
  cogs: number;
}

/**
 * One row per ad per day. Meta Insights gives spend, impressions, clicks,
 * platform purchases and the video funnel; Triple Whale's pixel adds the
 * new-customer (NC) and all-customer (TW) purchases attributed to the ad, and
 * new-visitor traffic. NC is the number that decides winners.
 */
export interface AdDailyInsight {
  tenantId: string;
  date: string;
  adId: string;
  adName: string;
  adSetId: string;
  adSetName: string;
  campaignId: string;
  campaignName: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  format: "Video" | "Static";
  thumbnailUrl: string | null;
  spend: number;
  impressions: number;
  clicks: number; // all clicks
  linkClicks: number; // outbound link clicks
  metaPurchases: number;
  metaRevenue: number;
  twPurchases: number; // Triple Whale, all customers
  twRevenue: number;
  ncPurchases: number; // Triple Whale, new customers
  ncRevenue: number;
  plays3s: number | null; // 3-second video plays
  thruplays: number | null;
  newVisitors: number | null;
  uniqueVisitors: number | null;
  launchedAt: string; // first spend day ever
}

/** ClickUp brief task for the Creative Output view (status history, no bodies). */
export interface CreativeTask {
  tenantId: string;
  taskId: string;
  name: string;
  strategist: string | null;
  editors: string[];
  product: string | null;
  kind: "Video" | "Static";
  status: "pending brief" | "for production" | "ready for edit" | "pre-launch review" | "revisions" | "ready for launch" | "completee";
  briefDate: string | null; // day it entered For production
  readyDate: string | null; // day it reached Ready for launch
  closedDate: string | null; // published
  updatedAt: string;
}

/** Thresholds that decide winners, potentials and the Creative Score. Editable per brand. */
export interface CreativeRules {
  minSpend: number; // tested = spent at least this in range
  winRoas: number; // NC ROAS at or above = winner
  winCpa: number; // or NC CPA at or below (0 disables)
  potRoas: number; // potential: between potRoas and winRoas
  minTested: number; // tested ads a strategist needs to be ranked
  minImp: number; // impressions before creative metrics are judged
  tgtHit: number; // weekly target hit rate
  tgtTested: number; // weekly target tested ads
}

export const DEFAULT_CREATIVE_RULES: CreativeRules = { minSpend: 50, winRoas: 0.9, winCpa: 0, potRoas: 0.7, minTested: 30, minImp: 1000, tgtHit: 0.15, tgtTested: 15 };

/** Cohort LTV row, from Lifetimely or computed from Shopify orders. */
export interface CohortRow {
  tenantId: string;
  cohortMonth: string;
  customers: number;
  ltv30: number;
  ltv60: number;
  ltv90: number;
  ltv180: number;
  repurchaseRate: number;
}

/** CS metrics per day, from Commslayer. */
export interface DailySupportMetrics {
  tenantId: string;
  date: string;
  tickets: number;
  firstResponseMinutes: number;
  refundRequests: number;
  chargebackAlerts: number;
  topReasons: { reason: string; count: number }[];
}

export interface IntegrationStatus {
  tenantId: string;
  provider: "shopify" | "meta" | "triple_whale" | "lifetimely" | "commslayer";
  connected: boolean;
  lastSyncAt: string | null;
  lastError: string | null; // plain-language, never a raw API error
  backfillProgress: number | null; // 0..1 during initial backfill
}

export interface Flag {
  tenantId: string;
  severity: "red" | "amber";
  code: "margin_below_rule" | "ncpa_above_allowable" | "chargeback_rate" | "stockout" | "sync_failed" | "opex_ratio";
  message: string;
  value: number | null;
  threshold: number | null;
}

export interface CoachNote {
  id: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface WbrReport {
  id: string;
  tenantId: string;
  weekStart: string; // Monday
  weekEnd: string;
  metrics: WbrMetrics;
  previous: WbrMetrics;
  commentary: string;
  generatedAt: string;
  coachAnnotation: string | null;
}

export interface WbrMetrics {
  revenue: number;
  orders: number;
  aov: number;
  adSpend: number;
  blendedRoas: number;
  newCustomers: number;
  ncpa: number; // new customer acquisition cost
  contributionMargin: number;
  contributionMarginPct: number;
  refundRate: number;
  upsellTakeRate: number | null;
  subscriptionActive: number | null;
  subscriptionChurn: number | null;
  ticketsPerHundredOrders: number | null;
}

// ---- Weekly Business Review working state --------------------------------

export type WbrItemType = "task" | "issue" | "need" | "decision";
export interface WbrItem {
  id: string;
  type: WbrItemType;
  title: string;
  owner: string;
  due: string | null; // ISO date
  status: "open" | "done" | "parked";
  note: string;
  week: string; // Monday of the week it was raised in
  createdAt: string;
  closedAt: string | null;
}

/** Everything a brand types into its weekly review: targets, who owns what, the line on each exception, and the board. One document per brand. */
export interface WbrState {
  targets: Record<string, number>; // kpi id → target
  owners: Record<string, string>; // scorecard group id → name
  notes: Record<string, Record<string, string>>; // weekStart → kpi id → one line on cause and next step
  items: WbrItem[];
}
export const emptyWbrState = (): WbrState => ({ targets: {}, owners: {}, notes: {}, items: [] });
