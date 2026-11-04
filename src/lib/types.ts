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
  adNamingConvention: string; // "[Angle] | [Stage] | [Hook] | [Format] | [Product] | [Creator]"
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
  refunds: number;
  cogs: number;
}

/** One row per ad per day, from Meta Insights (creative diagnostics only). */
export interface AdDailyInsight {
  tenantId: string;
  date: string;
  adId: string;
  adName: string;
  adSetId: string;
  campaignId: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  thumbstopRate: number | null; // 3s plays / impressions
  holdRate: number | null; // thruplays / 3s plays
  launchedAt: string;
}

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
