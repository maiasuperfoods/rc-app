// Demo tenants. Every brand, product, person and number here is invented.
// Used when DEMO_MODE=true or when Supabase is not configured, so the app can be
// clicked through end-to-end before any store is connected.

import type {
  AdDailyInsight,
  CreativeTask,
  BrandBook,
  CoachNote,
  CohortRow,
  CostInputs,
  DailyBusinessMetrics,
  DailySupportMetrics,
  IntegrationStatus,
  InventoryPosition,
  Offer,
  OpexLine,
  Product,
  Sku,
  SpendPlan,
  Supplier,
  Tenant,
  Upsell,
} from "@/lib/types";

// Small deterministic PRNG so the demo looks the same every load.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
function daysAgo(n: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export const DEMO_USER = { id: "demo-user", email: "you@example.com", name: "Demo Student" };
export const DEMO_COACH = { id: "demo-coach", email: "coach@example.com", name: "Coach" };

export const demoTenants: Tenant[] = [
  { id: "t-glowbright", name: "Glowbright Labs", domain: "glowbrightlabs.com", logoUrl: null, stage: "validation", tier: "ic", currency: "USD", timezone: "America/New_York", createdAt: iso(daysAgo(140)), onboardingComplete: true },
  { id: "t-harborpine", name: "Harbor & Pine", domain: "harborandpine.co", logoUrl: null, stage: "acceleration", tier: "ic", currency: "USD", timezone: "America/Los_Angeles", createdAt: iso(daysAgo(220)), onboardingComplete: true },
  { id: "t-ridgeline", name: "Ridgeline Supply", domain: "ridgelinesupply.com", logoUrl: null, stage: "grind", tier: "ic", currency: "USD", timezone: "America/Chicago", createdAt: iso(daysAgo(30)), onboardingComplete: false },
];

export const demoProducts: Product[] = [
  { id: "p-night", tenantId: "t-glowbright", title: "Night Reset Capsules", shopifyProductId: "gid://shopify/Product/1001", active: true },
  { id: "p-morning", tenantId: "t-glowbright", title: "Morning Clarity Powder", shopifyProductId: "gid://shopify/Product/1002", active: true },
  { id: "p-hp-serum", tenantId: "t-harborpine", title: "Sea Mineral Serum", shopifyProductId: "gid://shopify/Product/2001", active: true },
  { id: "p-rl-bottle", tenantId: "t-ridgeline", title: "Trail Flask 32oz", shopifyProductId: null, active: true },
];

export const demoSkus: Sku[] = [
  { id: "s-night-60", tenantId: "t-glowbright", productId: "p-night", sku: "NR-60", variantTitle: "Night Reset · 60 ct", shopifyVariantId: "gid://shopify/ProductVariant/1001-1", landedCost: 3.4, unitsPerPack: 1 },
  { id: "s-morning-30", tenantId: "t-glowbright", productId: "p-morning", sku: "MC-30", variantTitle: "Morning Clarity · 30 servings", shopifyVariantId: "gid://shopify/ProductVariant/1002-1", landedCost: 6.1, unitsPerPack: 1 },
  { id: "s-hp-serum-30", tenantId: "t-harborpine", productId: "p-hp-serum", sku: "SMS-30", variantTitle: "Serum · 30ml", shopifyVariantId: "gid://shopify/ProductVariant/2001-1", landedCost: 4.8, unitsPerPack: 1 },
  { id: "s-rl-flask", tenantId: "t-ridgeline", productId: "p-rl-bottle", sku: "TF-32", variantTitle: "Flask · Slate", shopifyVariantId: null, landedCost: 7.9, unitsPerPack: 1 },
];

export const demoCosts: Record<string, CostInputs> = {
  "t-glowbright": { tenantId: "t-glowbright", outboundShippingPerOrder: 5.2, fulfillmentPerOrder: 2.1, fulfillmentPerUnit: 0.35, processingRate: 0.029, processingFixed: 0.3, bufferRate: 0.07, refundRate: 0.04, chargebackRate: 0.004, targetMarginRule: 0.85 },
  "t-harborpine": { tenantId: "t-harborpine", outboundShippingPerOrder: 4.6, fulfillmentPerOrder: 1.9, fulfillmentPerUnit: 0.25, processingRate: 0.029, processingFixed: 0.3, bufferRate: 0.08, refundRate: 0.03, chargebackRate: 0.006, targetMarginRule: 0.85 },
  "t-ridgeline": { tenantId: "t-ridgeline", outboundShippingPerOrder: 7.4, fulfillmentPerOrder: 2.4, fulfillmentPerUnit: 0.6, processingRate: 0.029, processingFixed: 0.3, bufferRate: 0.07, refundRate: 0.05, chargebackRate: 0.003, targetMarginRule: 0.85 },
};

export const demoOffers: Offer[] = [
  { id: "o-b1g1", tenantId: "t-glowbright", name: "Buy 1 Get 1", price: 49, skuId: "s-night-60", unitsShipped: 2, isDefault: false },
  { id: "o-b2g2", tenantId: "t-glowbright", name: "Buy 2 Get 2", price: 89, skuId: "s-night-60", unitsShipped: 4, isDefault: true },
  { id: "o-b3g3", tenantId: "t-glowbright", name: "Buy 3 Get 3", price: 129, skuId: "s-night-60", unitsShipped: 6, isDefault: false },
  { id: "o-mc-1", tenantId: "t-glowbright", name: "Morning Clarity · 1 tub", price: 44, skuId: "s-morning-30", unitsShipped: 1, isDefault: false },
  { id: "o-hp-2", tenantId: "t-harborpine", name: "Serum · 2 pack", price: 79, skuId: "s-hp-serum-30", unitsShipped: 2, isDefault: true },
  { id: "o-rl-1", tenantId: "t-ridgeline", name: "Flask · single", price: 34, skuId: "s-rl-flask", unitsShipped: 1, isDefault: true },
];

export const demoUpsells: Upsell[] = [
  { id: "u-mag", tenantId: "t-glowbright", name: "Magnesium Glycinate add-on", price: 29, cogs: 4.2, takeRate: 0.22 },
  { id: "u-hp-mist", tenantId: "t-harborpine", name: "Hydrating Mist", price: 24, cogs: 3.1, takeRate: 0.18 },
];

export const demoOpex: OpexLine[] = [
  { id: "x1", tenantId: "t-glowbright", name: "Software", monthly: 900 },
  { id: "x2", tenantId: "t-glowbright", name: "Customer support", monthly: 3000 },
  { id: "x3", tenantId: "t-glowbright", name: "Creative strategist", monthly: 4000 },
  { id: "x4", tenantId: "t-glowbright", name: "Video editors", monthly: 2200 },
  { id: "x5", tenantId: "t-harborpine", name: "Software", monthly: 1400 },
  { id: "x6", tenantId: "t-harborpine", name: "Team", monthly: 11000 },
  { id: "x7", tenantId: "t-ridgeline", name: "Software", monthly: 300 },
];

export const demoSuppliers: Supplier[] = [
  { id: "sup1", tenantId: "t-glowbright", skuId: "s-night-60", name: "Northstar Nutraceuticals", leadTimeDays: 35, moq: 2000, paymentTerms: "50% deposit, 50% on ship" },
  { id: "sup2", tenantId: "t-glowbright", skuId: "s-morning-30", name: "Greenfield Blends", leadTimeDays: 28, moq: 1000, paymentTerms: "Net 30" },
  { id: "sup3", tenantId: "t-harborpine", skuId: "s-hp-serum-30", name: "Coastal Formulations", leadTimeDays: 42, moq: 3000, paymentTerms: "Net 30" },
];

export const demoInventory: Record<string, InventoryPosition[]> = {
  "t-glowbright": [
    { skuId: "s-night-60", onHand: 4200, inbound: [{ quantity: 10000, eta: iso(daysAgo(-41)), poNumber: "PO-0192" }], dailyVelocity30: 118 },
    { skuId: "s-morning-30", onHand: 1850, inbound: [], dailyVelocity30: 22 },
  ],
  "t-harborpine": [{ skuId: "s-hp-serum-30", onHand: 9800, inbound: [], dailyVelocity30: 95 }],
  "t-ridgeline": [{ skuId: "s-rl-flask", onHand: 600, inbound: [], dailyVelocity30: 4 }],
};

function nextMonths(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1));
    out.push(x.toISOString().slice(0, 7));
  }
  return out;
}
export const demoSpendPlans: Record<string, SpendPlan> = {
  "t-glowbright": { tenantId: "t-glowbright", months: nextMonths(3).map((month, i) => ({ month, spend: [50000, 65000, 80000][i] })) },
  "t-harborpine": { tenantId: "t-harborpine", months: nextMonths(3).map((month, i) => ({ month, spend: [90000, 95000, 100000][i] })) },
  "t-ridgeline": { tenantId: "t-ridgeline", months: nextMonths(3).map((month, i) => ({ month, spend: [4000, 6000, 8000][i] })) },
};

export const demoBrandBooks: Record<string, BrandBook> = {
  "t-glowbright": {
    tenantId: "t-glowbright",
    version: 7,
    updatedAt: iso(daysAgo(3)),
    category: "supplement",
    mechanism:
      "Night Reset uses a slow-release blend of magnesium, glycine and tart cherry so your body can drop into deep sleep on its own, instead of being knocked out by melatonin and waking up groggy.",
    avatars: [
      {
        id: "av1",
        name: "Wired Dana",
        age: "38–52",
        summary: "Runs a household and a job, falls asleep fine but wakes at 3am with a racing mind. Has tried melatonin and hates the hangover.",
        painPoints: ["3am wake-ups", "Melatonin grogginess", "Afternoon crash from caffeine"],
        desires: ["Wake up without an alarm", "Stop relying on coffee", "Feel like herself again"],
        objections: ["Another supplement that does nothing", "Will I become dependent on it?"],
        positioning: "We are the no-melatonin sleep reset for busy women over 40 who want deep sleep without the next-morning fog.",
      },
      {
        id: "av2",
        name: "Optimizer Marcus",
        age: "28–40",
        summary: "Tracks his sleep on a wearable, wants to move his deep-sleep number, reads ingredient labels.",
        painPoints: ["Low deep-sleep score", "Inconsistent recovery"],
        desires: ["A measurable improvement he can screenshot", "Clean label"],
        objections: ["Underdosed proprietary blends", "Is the magnesium form bioavailable?"],
        positioning: "We are the transparently dosed sleep stack for data-driven men who want a better deep-sleep score, not a sedative.",
      },
    ],
    angles: [
      { id: "an1", name: "It's not insomnia, it's a racing mind", avatarId: "av1", headlines: ["Why you wake up at 3am (and it's not stress)", "I stopped taking melatonin and finally slept through the night"], status: "winner" },
      { id: "an2", name: "Melatonin hangover", avatarId: "av1", headlines: ["Melatonin made me groggy for 2 years. This didn't."], status: "testing" },
      { id: "an3", name: "Deep sleep score", avatarId: "av2", headlines: ["My deep sleep went from 48 min to 1h52. Here's the stack."], status: "testing" },
      { id: "an4", name: "Doctor's wife", avatarId: "av1", headlines: ["My husband's a sleep doctor. This is what he actually gives me."], status: "untested" },
    ],
    proof: [
      { id: "pr1", type: "reviews", label: "4.8 stars, 2,100 reviews", detail: "Shopify + Judge.me, verified buyers" },
      { id: "pr2", type: "study", label: "Glycine and sleep quality", detail: "Published 2012 trial, 3g glycine before bed improved subjective sleep quality" },
      { id: "pr3", type: "authority", label: "Formulated with a registered dietitian", detail: "Name and credentials on the label" },
    ],
    objections: [
      { id: "ob1", objection: "Too expensive", answer: "Frame as $1.48 a night on the Buy 2 Get 2 offer; compare with a nightly glass of wine." },
      { id: "ob2", objection: "Will I become dependent?", answer: "No sedatives; the body is doing the work. Many customers taper to a few nights a week." },
    ],
    complianceRails: [
      "No disease claims (insomnia, anxiety, depression)",
      "Never say 'clinically proven' about our product; only about the ingredients' published studies",
      "No 'cure', 'treat', 'prevent'",
      "Before/after must be real customers with written consent",
      "FDA disclaimer on every landing page",
    ],
    adNamingConvention: "[Angle] | [Awareness] | [Name] | [Type] | [Product] | [Strategist]",
    strategists: [{ code: "JO", name: "Jo Lindqvist" }, { code: "PRI", name: "Priya Raman" }, { code: "MAR", name: "Marcus Hale" }, { code: "STU", name: "In-house studio" }],
  },
  "t-harborpine": {
    tenantId: "t-harborpine",
    version: 3,
    updatedAt: iso(daysAgo(12)),
    category: "skincare",
    mechanism: "Sea minerals bind water to the skin barrier so moisture stays in for 24 hours instead of evaporating by lunch.",
    avatars: [{ id: "av1", name: "Dry-Air Priya", age: "30–45", summary: "Works in an air-conditioned office, skin feels tight by midday.", painPoints: ["Tightness", "Flaking in winter"], desires: ["One product, done"], objections: ["Greasy finish"], positioning: "We are the one-step moisture lock for office workers whose skin dries out by noon." }],
    angles: [{ id: "an1", name: "Tight by noon", avatarId: "av1", headlines: ["Why your skin is tight by noon (it's your office)"], status: "winner" }],
    proof: [],
    objections: [],
    complianceRails: ["No 'anti-aging' claims", "No medical claims"],
    adNamingConvention: "[Angle] | [Awareness] | [Name] | [Type] | [Product] | [Strategist]",
    strategists: [{ code: "JO", name: "Jo Lindqvist" }, { code: "PRI", name: "Priya Raman" }, { code: "MAR", name: "Marcus Hale" }, { code: "STU", name: "In-house studio" }],
  },
  "t-ridgeline": {
    tenantId: "t-ridgeline",
    version: 1,
    updatedAt: iso(daysAgo(20)),
    category: "other",
    mechanism: "",
    avatars: [],
    angles: [],
    proof: [],
    objections: [],
    complianceRails: [],
    adNamingConvention: "[Angle] | [Awareness] | [Name] | [Type] | [Product] | [Strategist]",
    strategists: [],
  },
};

// ---- Time series ---------------------------------------------------------

function series(tenantId: string, seed: number, base: { revenue: number; spend: number; aov: number; growth: number; cogsPct: number }): DailyBusinessMetrics[] {
  const r = rng(seed);
  const out: DailyBusinessMetrics[] = [];
  for (let i = 119; i >= 0; i--) {
    const d = daysAgo(i);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 0.85 : 1;
    const trend = 1 + base.growth * ((119 - i) / 119);
    const noise = 0.8 + r() * 0.4;
    const revenue = base.revenue * trend * weekend * noise;
    const spend = base.spend * trend * (0.9 + r() * 0.2);
    const orders = Math.max(1, Math.round(revenue / base.aov));
    const newCustomers = Math.round(orders * (0.72 + r() * 0.1));
    out.push({
      tenantId,
      date: iso(d),
      revenue: Math.round(revenue),
      orders,
      newCustomers,
      returningCustomers: orders - newCustomers,
      adSpend: Math.round(spend),
      refunds: Math.round(revenue * (0.03 + r() * 0.02)),
      cogs: Math.round(revenue * base.cogsPct),
    });
  }
  return out;
}

export const demoDaily: Record<string, DailyBusinessMetrics[]> = {
  "t-glowbright": series("t-glowbright", 11, { revenue: 4100, spend: 1550, aov: 86, growth: 0.25, cogsPct: 0.16 }),
  "t-harborpine": series("t-harborpine", 23, { revenue: 9800, spend: 3100, aov: 74, growth: 0.1, cogsPct: 0.13 }),
  "t-ridgeline": series("t-ridgeline", 37, { revenue: 260, spend: 140, aov: 34, growth: 0.4, cogsPct: 0.25 }),
};

function supportSeries(tenantId: string, seed: number, ordersPerDay: number): DailySupportMetrics[] {
  const r = rng(seed);
  const out: DailySupportMetrics[] = [];
  for (let i = 59; i >= 0; i--) {
    const tickets = Math.round(ordersPerDay * (0.06 + r() * 0.04));
    out.push({
      tenantId,
      date: iso(daysAgo(i)),
      tickets,
      firstResponseMinutes: Math.round(40 + r() * 80),
      refundRequests: Math.round(tickets * 0.3),
      chargebackAlerts: r() > 0.9 ? 1 : 0,
      topReasons: [
        { reason: "Where is my order", count: Math.round(tickets * 0.45) },
        { reason: "Refund request", count: Math.round(tickets * 0.3) },
        { reason: "Subscription change", count: Math.round(tickets * 0.15) },
      ],
    });
  }
  return out;
}
export const demoSupport: Record<string, DailySupportMetrics[]> = {
  "t-glowbright": supportSeries("t-glowbright", 41, 48),
  "t-harborpine": supportSeries("t-harborpine", 43, 130),
  "t-ridgeline": [],
};

export const demoCohorts: Record<string, CohortRow[]> = {
  "t-glowbright": [0, 1, 2, 3, 4, 5].map((k) => {
    const d = new Date();
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (5 - k), 1));
    const base = 78 + k * 1.5;
    return { tenantId: "t-glowbright", cohortMonth: m.toISOString().slice(0, 7), customers: 900 + k * 140, ltv30: base, ltv60: base * 1.18, ltv90: base * 1.31, ltv180: k < 2 ? base * 1.52 : base * 1.31, repurchaseRate: 0.21 + k * 0.01 };
  }),
  "t-harborpine": [0, 1, 2, 3].map((k) => {
    const d = new Date();
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (3 - k), 1));
    return { tenantId: "t-harborpine", cohortMonth: m.toISOString().slice(0, 7), customers: 2800 + k * 100, ltv30: 71, ltv60: 84, ltv90: 95, ltv180: 112, repurchaseRate: 0.33 };
  }),
  "t-ridgeline": [],
};

// ---- Ads ----------------------------------------------------------------
// Ad names follow the SOP: Angle | Awareness | Name | Type | Product | Strategist

const ANGLES = ["RMD", "MEL", "DSS", "3AM", "DRW"]; // racing mind, melatonin hangover, deep-sleep score, 3am wake-up, doctor's wife
const AWARE = ["U", "PA", "SA", "PCTA", "MA"];
const TYPES = ["UGC", "VSL", "AI UGC", "AI Authority", "AI Animation", "Static"];
const STRATS = ["JO", "PRI", "MAR", "STU"];
const HOOK_NAMES = ["WakeAt3", "MelatoninFog", "ScoreScreenshot", "HusbandDoctor", "ItsNotStress", "TartCherry", "NoGroggy", "DeepSleep152"];

function adSeries(tenantId: string, seed: number, nAds: number, spendPerDay: number, product: string, hasPixel: boolean): AdDailyInsight[] {
  const r = rng(seed);
  const out: AdDailyInsight[] = [];
  const quality: Record<string, number> = { RMD: 1.25, "3AM": 1.1, MEL: 0.95, DSS: 0.8, DRW: 0.7 };
  const stratLift: Record<string, number> = { JO: 1.1, PRI: 0.95, MAR: 1.05, STU: 0.85 };
  for (let a = 0; a < nAds; a++) {
    const launched = 75 - Math.floor(r() * 73);
    const angle = ANGLES[Math.floor(r() * ANGLES.length)];
    const aware = AWARE[Math.floor(r() * AWARE.length)];
    const type = TYPES[Math.floor(r() * TYPES.length)];
    const strat = STRATS[Math.floor(r() * STRATS.length)];
    const hook = HOOK_NAMES[Math.floor(r() * HOOK_NAMES.length)];
    const ok = r() < 0.9;
    const adName = ok ? `${angle} | ${aware} | ${hook}${a} | ${type} | ${product} | ${strat}` : `${type} test ${a + 1}`;
    const format: "Video" | "Static" = type === "Static" ? "Static" : "Video";
    const q = (quality[angle] ?? 0.9) * (stratLift[strat] ?? 1) * (0.75 + r() * 0.5);
    const fatigue = r() < 0.25;
    const paused = r() < 0.2;
    const dailySpend = ((spendPerDay * (0.2 + r() * 1.6)) / nAds) * 3;
    const hookBase = 0.2 + r() * 0.2, holdBase = 0.1 + r() * 0.2, ctrBase = 0.008 + r() * 0.012;
    const stopDay = paused ? Math.floor(r() * 10) : 0;
    for (let i = launched; i >= stopDay; i--) {
      const age = launched - i;
      if (r() < 0.08) continue;
      const decay = fatigue ? Math.max(0.3, 1 - age / 40) : 1;
      const spend = dailySpend * (0.7 + r() * 0.6);
      const impressions = Math.round(spend / (0.016 + r() * 0.012));
      const linkClicks = Math.round(impressions * ctrBase * (0.8 + r() * 0.4));
      const ncRev = spend * q * decay * (0.8 + r() * 0.4);
      const ncPurchases = Math.round(ncRev / 92);
      const twPurchases = ncPurchases + Math.round(ncPurchases * (0.15 + r() * 0.2));
      const twRev = ncRev + (twPurchases - ncPurchases) * 79;
      const metaPurchases = Math.round(twPurchases * (1.1 + r() * 0.4));
      const uv = Math.round(linkClicks * 0.9);
      out.push({
        tenantId, date: iso(daysAgo(i)), adId: `${tenantId}-ad-${a}`, adName, adSetId: `as-${Math.floor(a / 4)}`, adSetName: `${angle} | ${aware} | Set ${Math.floor(a / 4)} | ${type} | ${product} | ${strat}`, campaignId: "cmp-1", campaignName: `${product} · Prospecting`,
        status: paused ? "PAUSED" : "ACTIVE", format, thumbnailUrl: null,
        spend: Math.round(spend * 100) / 100, impressions, clicks: Math.round(linkClicks * 1.6), linkClicks,
        metaPurchases, metaRevenue: Math.round(metaPurchases * 88), twPurchases: hasPixel ? twPurchases : 0, twRevenue: hasPixel ? Math.round(twRev) : 0, ncPurchases: hasPixel ? ncPurchases : 0, ncRevenue: hasPixel ? Math.round(ncRev) : 0,
        plays3s: format === "Video" ? Math.round(impressions * hookBase * (0.9 + r() * 0.2)) : null,
        thruplays: format === "Video" ? Math.round(impressions * hookBase * holdBase) : null,
        newVisitors: hasPixel ? Math.round(uv * (0.6 + r() * 0.3)) : null, uniqueVisitors: hasPixel ? uv : null,
        launchedAt: iso(daysAgo(launched)),
      });
    }
  }
  return out;
}
export const demoAds: Record<string, AdDailyInsight[]> = {
  "t-glowbright": adSeries("t-glowbright", 77, 34, 1550, "NightReset", true),
  "t-harborpine": adSeries("t-harborpine", 91, 40, 3100, "SeaSerum", true),
  "t-ridgeline": adSeries("t-ridgeline", 13, 5, 140, "TrailFlask", false),
};

// ---- ClickUp briefs (invented) --------------------------------------------

function taskSeries(tenantId: string, seed: number, n: number, product: string): CreativeTask[] {
  const r = rng(seed);
  const statuses: CreativeTask["status"][] = ["for production", "ready for edit", "pre-launch review", "revisions", "ready for launch", "completee"];
  const editors = ["Elin", "Tomas", "Ayo", "Mika"];
  const out: CreativeTask[] = [];
  for (let i = 0; i < n; i++) {
    const briefAgo = Math.floor(r() * 70);
    const strat = STRATS[Math.floor(r() * STRATS.length)];
    const status = statuses[Math.floor(r() * statuses.length)];
    const done = status === "ready for launch" || status === "completee";
    const readyAgo = done ? Math.max(0, briefAgo - Math.round(3 + r() * 9)) : null;
    const closedAgo = status === "completee" && readyAgo != null ? Math.max(0, readyAgo - Math.round(r() * 4)) : null;
    out.push({ tenantId, taskId: `t-${i}`, name: `${HOOK_NAMES[i % HOOK_NAMES.length]} ${TYPES[i % TYPES.length]} | ${product} | ${strat}`, strategist: r() < 0.92 ? strat : null, editors: [editors[Math.floor(r() * editors.length)]], product, kind: i % 6 === 5 ? "Static" : "Video", status, briefDate: iso(daysAgo(briefAgo)), readyDate: readyAgo == null ? null : iso(daysAgo(readyAgo)), closedDate: closedAgo == null ? null : iso(daysAgo(closedAgo)), updatedAt: iso(daysAgo(closedAgo ?? readyAgo ?? Math.max(0, briefAgo - Math.floor(r() * 5)))) });
  }
  return out;
}
export const demoTasks: Record<string, CreativeTask[]> = {
  "t-glowbright": taskSeries("t-glowbright", 101, 64, "NightReset"),
  "t-harborpine": taskSeries("t-harborpine", 103, 90, "SeaSerum"),
  "t-ridgeline": [],
};

export const demoIntegrations: Record<string, IntegrationStatus[]> = {
  "t-glowbright": [
    { tenantId: "t-glowbright", provider: "shopify", connected: true, lastSyncAt: new Date(Date.now() - 40 * 60000).toISOString(), lastError: null, backfillProgress: null },
    { tenantId: "t-glowbright", provider: "meta", connected: true, lastSyncAt: new Date(Date.now() - 5 * 3600000).toISOString(), lastError: null, backfillProgress: null },
    { tenantId: "t-glowbright", provider: "triple_whale", connected: true, lastSyncAt: new Date(Date.now() - 6 * 3600000).toISOString(), lastError: null, backfillProgress: null },
    { tenantId: "t-glowbright", provider: "lifetimely", connected: true, lastSyncAt: new Date(Date.now() - 7 * 3600000).toISOString(), lastError: null, backfillProgress: null },
    { tenantId: "t-glowbright", provider: "commslayer", connected: true, lastSyncAt: new Date(Date.now() - 2 * 3600000).toISOString(), lastError: null, backfillProgress: null },
  ],
  "t-harborpine": [
    { tenantId: "t-harborpine", provider: "shopify", connected: true, lastSyncAt: new Date(Date.now() - 30 * 60000).toISOString(), lastError: null, backfillProgress: null },
    { tenantId: "t-harborpine", provider: "meta", connected: true, lastSyncAt: new Date(Date.now() - 3 * 86400000).toISOString(), lastError: "Your Meta connection expired. Reconnect to resume the creative dashboard.", backfillProgress: null },
    { tenantId: "t-harborpine", provider: "triple_whale", connected: true, lastSyncAt: new Date(Date.now() - 5 * 3600000).toISOString(), lastError: null, backfillProgress: null },
    { tenantId: "t-harborpine", provider: "lifetimely", connected: false, lastSyncAt: null, lastError: null, backfillProgress: null },
    { tenantId: "t-harborpine", provider: "commslayer", connected: true, lastSyncAt: new Date(Date.now() - 2 * 3600000).toISOString(), lastError: null, backfillProgress: null },
  ],
  "t-ridgeline": [
    { tenantId: "t-ridgeline", provider: "shopify", connected: true, lastSyncAt: new Date(Date.now() - 20 * 60000).toISOString(), lastError: null, backfillProgress: 0.62 },
    { tenantId: "t-ridgeline", provider: "meta", connected: false, lastSyncAt: null, lastError: null, backfillProgress: null },
    { tenantId: "t-ridgeline", provider: "triple_whale", connected: false, lastSyncAt: null, lastError: null, backfillProgress: null },
    { tenantId: "t-ridgeline", provider: "lifetimely", connected: false, lastSyncAt: null, lastError: null, backfillProgress: null },
    { tenantId: "t-ridgeline", provider: "commslayer", connected: false, lastSyncAt: null, lastError: null, backfillProgress: null },
  ],
};

export const demoNotes: CoachNote[] = [
  { id: "n1", tenantId: "t-glowbright", authorId: DEMO_COACH.id, authorName: "Coach", body: "Agreed on the call: hold spend flat until the Melatonin Hangover angle has 3 iterations live. Revisit B3G3 pricing next week.", createdAt: new Date(Date.now() - 6 * 86400000).toISOString() },
  { id: "n2", tenantId: "t-harborpine", authorId: DEMO_COACH.id, authorName: "Coach", body: "Meta token expired again — walked them through reconnecting. Chargeback rate creeping; asked them to add order tracking emails.", createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
];

// ---- Forecast model (invented) ------------------------------------------

import type { ForecastInputs } from "@/lib/calc/forecast";

function mondayIso(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - day + 1);
  return iso(x);
}
const fcStart = mondayIso(new Date());
function preCohorts(n: number, base: number, growth: number) {
  const out: { weekStart: string; newCustomers: number; regime: "old" | "new" }[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(fcStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7 * i);
    out.push({ weekStart: iso(d), newCustomers: Math.round(base * Math.pow(1 + growth, n - i)), regime: i > 8 ? "old" : "new" });
  }
  return out;
}

export const demoForecasts: Record<string, ForecastInputs> = {
  "t-glowbright": {
    startDate: fcStart,
    horizonWeeks: 39,
    cashOnHand: 142000,
    cashBuffer: 40000,
    paypalShare: 0.18,
    paypalReserve: 0.2,
    reserveReleaseWeeks: 9,
    payoutDelayWeeks: 0,
    adSpendLagWeeks: 5,
    cardLimit: 250000,
    cardCashback: 0,
    refundRate: 0.028,
    processingRate: 0.035,
    preCardCharges: [0, 0, 0, 9000, 10200],
    fixedOpexMonthly: 10100,
    variableOpexRate: 0.05,
    extraStrategists: [{ fromWeek: 6, monthly: 4000 }],
    cycle1Rate: 0.42,
    retention: 0.7,
    cycle1RateOld: 0.15,
    retentionOld: 0.9,
    poCadenceWeeks: 4,
    safetyWeeks: 2,
    depositShare: 0.3,
    lines: [
      {
        id: "line-night", name: "Night Reset", rampStartWeek: 1, dailySpendStart: 1550, dailySpendTarget1: 3000, target1Week: 6, dailySpendTarget2: 5000, target2Week: 14, weeklyGrowthAfter: 0,
        roasStart: 1.3, roasScale: 1.15, roasScaleWeek: 6, firstOrderAov: 95.4, upsellTakeRate: 0.22, upsellPrice: 29, upsellPoolId: "pool-mag", upsellUnitsPerOrder: 1,
        fulfillmentNew: 8.1, fulfillmentRebill: 6.5, rebillRevenue: 79, unitsPerNewOrder: { "pool-night": 3.6 }, unitsPerRebillOrder: { "pool-night": 2 }, spendOverrides: {},
        preCohorts: preCohorts(20, 150, 0.06), longTailWeekly: 1100, longTailDecay: 0.02,
      },
      {
        id: "line-morning", name: "Morning Clarity", rampStartWeek: 8, dailySpendStart: 400, dailySpendTarget1: 1200, target1Week: 16, dailySpendTarget2: 2000, target2Week: 26, weeklyGrowthAfter: 0,
        roasStart: 1.0, roasScale: 1.05, roasScaleWeek: 14, firstOrderAov: 68, upsellTakeRate: 0, upsellPrice: 0, upsellPoolId: null, upsellUnitsPerOrder: 0,
        fulfillmentNew: 7.4, fulfillmentRebill: 6.5, rebillRevenue: 44, unitsPerNewOrder: { "pool-morning": 1.5 }, unitsPerRebillOrder: { "pool-morning": 1 }, spendOverrides: {},
        preCohorts: [], longTailWeekly: 0, longTailDecay: 0.02,
      },
    ],
    pools: [
      { id: "pool-night", name: "Night Reset bottles (60 ct)", onHand: 4200, landedCost: 3.4, leadWeeks: 5, scheduledInbound: [{ week: 6, units: 10000 }] },
      { id: "pool-morning", name: "Morning Clarity tubs", onHand: 1850, landedCost: 6.1, leadWeeks: 4, scheduledInbound: [] },
      { id: "pool-mag", name: "Magnesium add-on bottles", onHand: 1200, landedCost: 4.2, leadWeeks: 4, scheduledInbound: [{ week: 3, units: 3000 }] },
    ],
    committed: [
      { week: 2, amount: 23800, what: "PO-0192 balance · Night Reset 10,000" },
      { week: 3, amount: 4200, what: "Sea freight + duties on PO-0192" },
      { week: 2, amount: 8820, what: "Magnesium 3,000 balance" },
    ],
  },
};
