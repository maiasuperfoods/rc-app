import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataSource, SessionUser } from "./source";
import type {
  AdDailyInsight,
  BrandBook,
  CoachNote,
  CohortRow,
  CostInputs,
  DailyBusinessMetrics,
  DailySupportMetrics,
  IntegrationStatus,
  InventoryPosition,
  Membership,
  Offer,
  OpexLine,
  Product,
  Sku,
  SpendPlan,
  Supplier,
  Tenant,
  Upsell,
  WbrReport,
} from "@/lib/types";
import { emptyBrandBook } from "./demo";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown) => (v == null ? 0 : Number(v));

function mapTenant(r: Row): Tenant {
  return { id: r.id, name: r.name, domain: r.domain, logoUrl: r.logo_url, stage: r.stage, tier: r.tier, currency: r.currency, timezone: r.timezone, createdAt: r.created_at, onboardingComplete: r.onboarding_complete };
}

export class SupabaseSource implements DataSource {
  constructor(private readonly db: SupabaseClient) {}

  private async q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data as T;
  }

  async currentUser(): Promise<SessionUser | null> {
    const { data } = await this.db.auth.getUser();
    const u = data.user;
    if (!u) return null;
    return { id: u.id, email: u.email ?? "", name: (u.user_metadata?.full_name as string) || u.email?.split("@")[0] || "You" };
  }
  async memberships(userId: string): Promise<Membership[]> {
    const rows = await this.q<Row[]>(this.db.from("tenant_members").select("tenant_id,user_id,role").eq("user_id", userId));
    return rows.map((r) => ({ tenantId: r.tenant_id, userId: r.user_id, role: r.role }));
  }
  async isCoach(userId: string) {
    const rows = await this.q<Row[]>(this.db.from("app_roles").select("role").eq("user_id", userId).in("role", ["coach", "admin"]));
    return rows.length > 0;
  }

  async tenants(ids: string[] | "all") {
    let query = this.db.from("tenants").select("*").order("name");
    if (ids !== "all") query = query.in("id", ids);
    return (await this.q<Row[]>(query)).map(mapTenant);
  }
  async tenant(id: string) {
    const rows = await this.q<Row[]>(this.db.from("tenants").select("*").eq("id", id).limit(1));
    return rows[0] ? mapTenant(rows[0]) : null;
  }
  async createTenant(input: { name: string; domain: string | null; stage: Tenant["stage"]; ownerId: string }) {
    const rows = await this.q<Row[]>(this.db.from("tenants").insert({ name: input.name, domain: input.domain, stage: input.stage }).select("*"));
    const t = mapTenant(rows[0]);
    await this.q(this.db.from("tenant_members").insert({ tenant_id: t.id, user_id: input.ownerId, role: "student" }));
    await this.q(this.db.from("cost_inputs").insert({ tenant_id: t.id }));
    return t;
  }
  async updateTenant(id: string, patch: Partial<Tenant>) {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.domain !== undefined) row.domain = patch.domain;
    if (patch.stage !== undefined) row.stage = patch.stage;
    if (patch.onboardingComplete !== undefined) row.onboarding_complete = patch.onboardingComplete;
    if (patch.currency !== undefined) row.currency = patch.currency;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    const rows = await this.q<Row[]>(this.db.from("tenants").update(row).eq("id", id).select("*"));
    return mapTenant(rows[0]);
  }

  async products(tenantId: string): Promise<Product[]> {
    const rows = await this.q<Row[]>(this.db.from("products").select("*").eq("tenant_id", tenantId).order("title"));
    return rows.map((r) => ({ id: r.id, tenantId: r.tenant_id, title: r.title, shopifyProductId: r.shopify_product_id, active: r.active }));
  }
  async skus(tenantId: string): Promise<Sku[]> {
    const rows = await this.q<Row[]>(this.db.from("skus").select("*").eq("tenant_id", tenantId).order("sku"));
    return rows.map((r) => ({ id: r.id, tenantId: r.tenant_id, productId: r.product_id, sku: r.sku, variantTitle: r.variant_title, shopifyVariantId: r.shopify_variant_id, landedCost: num(r.landed_cost), unitsPerPack: num(r.units_per_pack) || 1 }));
  }
  async upsertSkus(tenantId: string, skus: Sku[]) {
    await this.q(this.db.from("skus").upsert(skus.map((s) => ({ id: s.id, tenant_id: tenantId, product_id: s.productId, sku: s.sku, variant_title: s.variantTitle, shopify_variant_id: s.shopifyVariantId, landed_cost: s.landedCost, units_per_pack: s.unitsPerPack }))));
  }
  async costInputs(tenantId: string): Promise<CostInputs> {
    const rows = await this.q<Row[]>(this.db.from("cost_inputs").select("*").eq("tenant_id", tenantId).limit(1));
    const r = rows[0] ?? {};
    return {
      tenantId,
      outboundShippingPerOrder: num(r.outbound_shipping_per_order ?? 5.2),
      fulfillmentPerOrder: num(r.fulfillment_per_order ?? 2.1),
      fulfillmentPerUnit: num(r.fulfillment_per_unit ?? 0.35),
      processingRate: num(r.processing_rate ?? 0.029),
      processingFixed: num(r.processing_fixed ?? 0.3),
      bufferRate: num(r.buffer_rate ?? 0.07),
      refundRate: num(r.refund_rate ?? 0.04),
      chargebackRate: num(r.chargeback_rate ?? 0.004),
      targetMarginRule: num(r.target_margin_rule ?? 0.85),
    };
  }
  async saveCostInputs(c: CostInputs) {
    await this.q(
      this.db.from("cost_inputs").upsert({
        tenant_id: c.tenantId,
        outbound_shipping_per_order: c.outboundShippingPerOrder,
        fulfillment_per_order: c.fulfillmentPerOrder,
        fulfillment_per_unit: c.fulfillmentPerUnit,
        processing_rate: c.processingRate,
        processing_fixed: c.processingFixed,
        buffer_rate: c.bufferRate,
        refund_rate: c.refundRate,
        chargeback_rate: c.chargebackRate,
        target_margin_rule: c.targetMarginRule,
      }),
    );
  }
  async offers(tenantId: string): Promise<Offer[]> {
    const rows = await this.q<Row[]>(this.db.from("offers").select("*").eq("tenant_id", tenantId).order("price"));
    return rows.map((r) => ({ id: r.id, tenantId: r.tenant_id, name: r.name, price: num(r.price), skuId: r.sku_id, unitsShipped: num(r.units_shipped), isDefault: r.is_default }));
  }
  async saveOffers(tenantId: string, offers: Offer[]) {
    await this.q(this.db.from("offers").delete().eq("tenant_id", tenantId));
    if (offers.length)
      await this.q(this.db.from("offers").insert(offers.map((o) => ({ tenant_id: tenantId, name: o.name, price: o.price, sku_id: o.skuId, units_shipped: o.unitsShipped, is_default: o.isDefault }))));
  }
  async upsells(tenantId: string): Promise<Upsell[]> {
    const rows = await this.q<Row[]>(this.db.from("upsells").select("*").eq("tenant_id", tenantId));
    return rows.map((r) => ({ id: r.id, tenantId: r.tenant_id, name: r.name, price: num(r.price), cogs: num(r.cogs), takeRate: num(r.take_rate) }));
  }
  async saveUpsells(tenantId: string, upsells: Upsell[]) {
    await this.q(this.db.from("upsells").delete().eq("tenant_id", tenantId));
    if (upsells.length) await this.q(this.db.from("upsells").insert(upsells.map((u) => ({ tenant_id: tenantId, name: u.name, price: u.price, cogs: u.cogs, take_rate: u.takeRate }))));
  }
  async opex(tenantId: string): Promise<OpexLine[]> {
    const rows = await this.q<Row[]>(this.db.from("opex_lines").select("*").eq("tenant_id", tenantId));
    return rows.map((r) => ({ id: r.id, tenantId: r.tenant_id, name: r.name, monthly: num(r.monthly) }));
  }
  async saveOpex(tenantId: string, lines: OpexLine[]) {
    await this.q(this.db.from("opex_lines").delete().eq("tenant_id", tenantId));
    if (lines.length) await this.q(this.db.from("opex_lines").insert(lines.map((l) => ({ tenant_id: tenantId, name: l.name, monthly: l.monthly }))));
  }

  async suppliers(tenantId: string): Promise<Supplier[]> {
    const rows = await this.q<Row[]>(this.db.from("suppliers").select("*").eq("tenant_id", tenantId));
    return rows.map((r) => ({ id: r.id, tenantId: r.tenant_id, skuId: r.sku_id, name: r.name, leadTimeDays: num(r.lead_time_days), moq: num(r.moq), paymentTerms: r.payment_terms ?? "" }));
  }
  async saveSuppliers(tenantId: string, s: Supplier[]) {
    await this.q(this.db.from("suppliers").delete().eq("tenant_id", tenantId));
    if (s.length) await this.q(this.db.from("suppliers").insert(s.map((x) => ({ tenant_id: tenantId, sku_id: x.skuId, name: x.name, lead_time_days: x.leadTimeDays, moq: x.moq, payment_terms: x.paymentTerms }))));
  }
  async inventory(tenantId: string): Promise<InventoryPosition[]> {
    const [levels, pos] = await Promise.all([
      this.q<Row[]>(this.db.from("inventory_levels").select("*").eq("tenant_id", tenantId)),
      this.q<Row[]>(this.db.from("purchase_orders").select("*").eq("tenant_id", tenantId).eq("received", false)),
    ]);
    return levels.map((l) => ({
      skuId: l.sku_id,
      onHand: num(l.on_hand),
      dailyVelocity30: num(l.daily_velocity_30),
      inbound: pos.filter((p) => p.sku_id === l.sku_id).map((p) => ({ quantity: num(p.quantity), eta: p.eta, poNumber: p.po_number })),
    }));
  }
  async spendPlan(tenantId: string): Promise<SpendPlan> {
    const rows = await this.q<Row[]>(this.db.from("spend_plans").select("*").eq("tenant_id", tenantId).order("month"));
    return { tenantId, months: rows.map((r) => ({ month: r.month, spend: num(r.spend) })) };
  }
  async saveSpendPlan(plan: SpendPlan) {
    await this.q(this.db.from("spend_plans").delete().eq("tenant_id", plan.tenantId));
    if (plan.months.length) await this.q(this.db.from("spend_plans").insert(plan.months.map((m) => ({ tenant_id: plan.tenantId, month: m.month, spend: m.spend }))));
  }

  async brandBook(tenantId: string): Promise<BrandBook> {
    const rows = await this.q<Row[]>(this.db.from("brand_books").select("*").eq("tenant_id", tenantId).limit(1));
    if (!rows[0]) return emptyBrandBook(tenantId);
    return { ...(rows[0].data as BrandBook), tenantId, version: rows[0].version, updatedAt: rows[0].updated_at };
  }
  async saveBrandBook(book: BrandBook, authorId: string) {
    const version = book.version + 1;
    const { tenantId: _t, version: _v, updatedAt: _u, ...data } = book;
    void _t; void _v; void _u;
    await this.q(this.db.from("brand_books").upsert({ tenant_id: book.tenantId, version, data, updated_at: new Date().toISOString() }));
    await this.q(this.db.from("brand_book_versions").insert({ tenant_id: book.tenantId, version, data, author_id: authorId }));
    return { ...book, version, updatedAt: new Date().toISOString() };
  }

  async dailyMetrics(tenantId: string, fromDate: string): Promise<DailyBusinessMetrics[]> {
    const rows = await this.q<Row[]>(this.db.from("daily_business_metrics").select("*").eq("tenant_id", tenantId).gte("date", fromDate).order("date"));
    return rows.map((r) => ({ tenantId, date: r.date, revenue: num(r.revenue), orders: num(r.orders), newCustomers: num(r.new_customers), returningCustomers: num(r.returning_customers), adSpend: num(r.ad_spend), refunds: num(r.refunds), cogs: num(r.cogs) }));
  }
  async supportMetrics(tenantId: string, fromDate: string): Promise<DailySupportMetrics[]> {
    const rows = await this.q<Row[]>(this.db.from("daily_support_metrics").select("*").eq("tenant_id", tenantId).gte("date", fromDate).order("date"));
    return rows.map((r) => ({ tenantId, date: r.date, tickets: num(r.tickets), firstResponseMinutes: num(r.first_response_minutes), refundRequests: num(r.refund_requests), chargebackAlerts: num(r.chargeback_alerts), topReasons: r.top_reasons ?? [] }));
  }
  async cohorts(tenantId: string): Promise<CohortRow[]> {
    const rows = await this.q<Row[]>(this.db.from("cohorts").select("*").eq("tenant_id", tenantId).order("cohort_month"));
    return rows.map((r) => ({ tenantId, cohortMonth: r.cohort_month, customers: num(r.customers), ltv30: num(r.ltv30), ltv60: num(r.ltv60), ltv90: num(r.ltv90), ltv180: num(r.ltv180), repurchaseRate: num(r.repurchase_rate) }));
  }
  async adInsights(tenantId: string, fromDate: string): Promise<AdDailyInsight[]> {
    const rows = await this.q<Row[]>(this.db.from("ad_daily_insights").select("*").eq("tenant_id", tenantId).gte("date", fromDate).order("date"));
    return rows.map((r) => ({ tenantId, date: r.date, adId: r.ad_id, adName: r.ad_name, adSetId: r.ad_set_id, campaignId: r.campaign_id, spend: num(r.spend), impressions: num(r.impressions), clicks: num(r.clicks), purchases: num(r.purchases), purchaseValue: num(r.purchase_value), thumbstopRate: r.thumbstop_rate == null ? null : num(r.thumbstop_rate), holdRate: r.hold_rate == null ? null : num(r.hold_rate), launchedAt: r.launched_at }));
  }
  async integrations(tenantId: string): Promise<IntegrationStatus[]> {
    const rows = await this.q<Row[]>(this.db.from("integrations").select("tenant_id,provider,connected,last_sync_at,last_error,backfill_progress").eq("tenant_id", tenantId));
    const providers: IntegrationStatus["provider"][] = ["shopify", "meta", "triple_whale", "lifetimely", "commslayer"];
    return providers.map((p) => {
      const r = rows.find((x) => x.provider === p);
      return { tenantId, provider: p, connected: r?.connected ?? false, lastSyncAt: r?.last_sync_at ?? null, lastError: r?.last_error ?? null, backfillProgress: r?.backfill_progress == null ? null : num(r.backfill_progress) };
    });
  }

  async wbrReports(tenantId: string, limit: number): Promise<WbrReport[]> {
    const rows = await this.q<Row[]>(this.db.from("wbr_reports").select("*").eq("tenant_id", tenantId).order("week_start", { ascending: false }).limit(limit));
    return rows.map((r) => ({ id: r.id, tenantId, weekStart: r.week_start, weekEnd: r.week_end, metrics: r.metrics, previous: r.previous, commentary: r.commentary, generatedAt: r.generated_at, coachAnnotation: r.coach_annotation }));
  }
  async saveWbrReport(r: WbrReport) {
    await this.q(this.db.from("wbr_reports").upsert({ tenant_id: r.tenantId, week_start: r.weekStart, week_end: r.weekEnd, metrics: r.metrics, previous: r.previous, commentary: r.commentary, generated_at: r.generatedAt, coach_annotation: r.coachAnnotation }, { onConflict: "tenant_id,week_start" }));
  }
  async annotateWbr(reportId: string, annotation: string) {
    await this.q(this.db.from("wbr_reports").update({ coach_annotation: annotation }).eq("id", reportId));
  }

  async notes(tenantId: string): Promise<CoachNote[]> {
    const rows = await this.q<Row[]>(this.db.from("coach_notes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }));
    return rows.map((r) => ({ id: r.id, tenantId, authorId: r.author_id, authorName: r.author_name, body: r.body, createdAt: r.created_at }));
  }
  async addNote(n: Omit<CoachNote, "id" | "createdAt">) {
    const rows = await this.q<Row[]>(this.db.from("coach_notes").insert({ tenant_id: n.tenantId, author_id: n.authorId, author_name: n.authorName, body: n.body }).select("*"));
    const r = rows[0];
    return { id: r.id, tenantId: r.tenant_id, authorId: r.author_id, authorName: r.author_name, body: r.body, createdAt: r.created_at };
  }
}
