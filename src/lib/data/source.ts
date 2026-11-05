import type { ForecastInputs } from "@/lib/calc/forecast";
import type {
  AdDailyInsight,
  BrandBook,
  CoachNote,
  CohortRow,
  CostInputs,
  CreativeTask,
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

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Everything the UI reads or writes goes through this interface, so the demo
 * tenant and the real Supabase tables are interchangeable. Tenant scoping is
 * enforced twice: here by tenantId, and in Postgres by RLS.
 */
export interface DataSource {
  // identity
  currentUser(): Promise<SessionUser | null>;
  memberships(userId: string): Promise<Membership[]>;
  isCoach(userId: string): Promise<boolean>;

  // tenants
  tenants(ids: string[] | "all"): Promise<Tenant[]>;
  tenant(id: string): Promise<Tenant | null>;
  createTenant(input: { name: string; domain: string | null; stage: Tenant["stage"]; ownerId: string }): Promise<Tenant>;
  updateTenant(id: string, patch: Partial<Pick<Tenant, "name" | "domain" | "stage" | "onboardingComplete" | "currency" | "timezone">>): Promise<Tenant>;

  // catalogue + economics inputs
  products(tenantId: string): Promise<Product[]>;
  skus(tenantId: string): Promise<Sku[]>;
  upsertSkus(tenantId: string, skus: Sku[]): Promise<void>;
  costInputs(tenantId: string): Promise<CostInputs>;
  saveCostInputs(c: CostInputs): Promise<void>;
  offers(tenantId: string): Promise<Offer[]>;
  saveOffers(tenantId: string, offers: Offer[]): Promise<void>;
  upsells(tenantId: string): Promise<Upsell[]>;
  saveUpsells(tenantId: string, upsells: Upsell[]): Promise<void>;
  opex(tenantId: string): Promise<OpexLine[]>;
  saveOpex(tenantId: string, lines: OpexLine[]): Promise<void>;

  // inventory
  suppliers(tenantId: string): Promise<Supplier[]>;
  saveSuppliers(tenantId: string, s: Supplier[]): Promise<void>;
  inventory(tenantId: string): Promise<InventoryPosition[]>;
  spendPlan(tenantId: string): Promise<SpendPlan>;
  saveSpendPlan(plan: SpendPlan): Promise<void>;

  // forecast model
  forecastInputs(tenantId: string): Promise<ForecastInputs | null>;
  saveForecastInputs(tenantId: string, inputs: ForecastInputs): Promise<void>;

  // brand book
  brandBook(tenantId: string): Promise<BrandBook>;
  saveBrandBook(book: BrandBook, authorId: string): Promise<BrandBook>;

  // ingested metrics (read-only from the UI; workers write)
  dailyMetrics(tenantId: string, fromDate: string): Promise<DailyBusinessMetrics[]>;
  supportMetrics(tenantId: string, fromDate: string): Promise<DailySupportMetrics[]>;
  cohorts(tenantId: string): Promise<CohortRow[]>;
  adInsights(tenantId: string, fromDate: string): Promise<AdDailyInsight[]>;
  integrations(tenantId: string): Promise<IntegrationStatus[]>;
  creativeTasks(tenantId: string): Promise<CreativeTask[]>;

  // WBR
  wbrReports(tenantId: string, limit: number): Promise<WbrReport[]>;
  saveWbrReport(r: WbrReport): Promise<void>;
  annotateWbr(reportId: string, annotation: string): Promise<void>;

  // coach notes
  notes(tenantId: string): Promise<CoachNote[]>;
  addNote(n: Omit<CoachNote, "id" | "createdAt">): Promise<CoachNote>;
}
