import type { DataSource, SessionUser } from "./source";
import type { BrandBook, CoachNote, CostInputs, Membership, Offer, OpexLine, Sku, SpendPlan, Supplier, Tenant, Upsell, WbrReport, WbrState } from "@/lib/types";
import { emptyWbrState } from "@/lib/types";
import * as D from "@/lib/demo/data";
import type { ForecastInputs } from "@/lib/calc/forecast";

// Mutable in-process store so edits persist for the life of the server process.
// `globalThis` keeps it across Next.js hot reloads in development.
type Store = {
  tenants: Tenant[];
  skus: Sku[];
  costs: Record<string, CostInputs>;
  offers: Offer[];
  upsells: Upsell[];
  opex: OpexLine[];
  suppliers: Supplier[];
  spendPlans: Record<string, SpendPlan>;
  brandBooks: Record<string, BrandBook>;
  wbr: WbrReport[];
  notes: CoachNote[];
  forecasts: Record<string, ForecastInputs>;
  wbrState: Record<string, WbrState>;
};
const g = globalThis as unknown as { __rcDemoStore?: Store };
function store(): Store {
  if (!g.__rcDemoStore) {
    g.__rcDemoStore = {
      tenants: structuredClone(D.demoTenants),
      skus: structuredClone(D.demoSkus),
      costs: structuredClone(D.demoCosts),
      offers: structuredClone(D.demoOffers),
      upsells: structuredClone(D.demoUpsells),
      opex: structuredClone(D.demoOpex),
      suppliers: structuredClone(D.demoSuppliers),
      spendPlans: structuredClone(D.demoSpendPlans),
      brandBooks: structuredClone(D.demoBrandBooks),
      wbr: [],
      notes: structuredClone(D.demoNotes),
      forecasts: structuredClone(D.demoForecasts),
      wbrState: {},
    };
  }
  return g.__rcDemoStore;
}

const defaultCosts = (tenantId: string): CostInputs => ({
  tenantId,
  outboundShippingPerOrder: 5.2,
  fulfillmentPerOrder: 2.1,
  fulfillmentPerUnit: 0.35,
  processingRate: 0.029,
  processingFixed: 0.3,
  bufferRate: 0.07,
  refundRate: 0.04,
  chargebackRate: 0.004,
  targetMarginRule: 0.85,
});

export const emptyBrandBook = (tenantId: string): BrandBook => ({
  tenantId,
  version: 1,
  updatedAt: new Date().toISOString(),
  category: "supplement",
  mechanism: "",
  avatars: [],
  angles: [],
  proof: [],
  objections: [],
  complianceRails: ["No disease claims", "No 'cure', 'treat' or 'prevent'", "Before/after only with written consent"],
  adNamingConvention: "[Angle] | [Awareness] | [Name] | [Type] | [Product] | [Strategist]",
  strategists: [],
});

export class DemoSource implements DataSource {
  constructor(private readonly asCoach: boolean) {}

  async currentUser(): Promise<SessionUser> {
    return this.asCoach ? D.DEMO_COACH : D.DEMO_USER;
  }
  async memberships(userId: string): Promise<Membership[]> {
    if (userId === D.DEMO_COACH.id) return store().tenants.map((t) => ({ tenantId: t.id, userId, role: "coach" as const }));
    return [{ tenantId: "t-glowbright", userId, role: "student" }];
  }
  async isCoach(userId: string) {
    return userId === D.DEMO_COACH.id;
  }

  async tenants(ids: string[] | "all") {
    const all = store().tenants;
    return ids === "all" ? all : all.filter((t) => ids.includes(t.id));
  }
  async tenant(id: string) {
    return store().tenants.find((t) => t.id === id) ?? null;
  }
  async createTenant(input: { name: string; domain: string | null; stage: Tenant["stage"]; ownerId: string }) {
    const t: Tenant = { id: `t-${Date.now()}`, name: input.name, domain: input.domain, logoUrl: null, stage: input.stage, tier: "ic", currency: "USD", timezone: "America/New_York", createdAt: new Date().toISOString(), onboardingComplete: false, pcStudentId: null };
    store().tenants.push(t);
    return t;
  }
  async updateTenant(id: string, patch: Partial<Tenant>) {
    const t = store().tenants.find((x) => x.id === id);
    if (!t) throw new Error("tenant not found");
    Object.assign(t, patch);
    return t;
  }

  async products(tenantId: string) {
    return D.demoProducts.filter((p) => p.tenantId === tenantId);
  }
  async skus(tenantId: string) {
    return store().skus.filter((s) => s.tenantId === tenantId);
  }
  async upsertSkus(tenantId: string, skus: Sku[]) {
    const s = store();
    s.skus = s.skus.filter((x) => x.tenantId !== tenantId).concat(skus);
  }
  async costInputs(tenantId: string) {
    return store().costs[tenantId] ?? defaultCosts(tenantId);
  }
  async saveCostInputs(c: CostInputs) {
    store().costs[c.tenantId] = c;
  }
  async offers(tenantId: string) {
    return store().offers.filter((o) => o.tenantId === tenantId);
  }
  async saveOffers(tenantId: string, offers: Offer[]) {
    const s = store();
    s.offers = s.offers.filter((x) => x.tenantId !== tenantId).concat(offers);
  }
  async upsells(tenantId: string) {
    return store().upsells.filter((u) => u.tenantId === tenantId);
  }
  async saveUpsells(tenantId: string, upsells: Upsell[]) {
    const s = store();
    s.upsells = s.upsells.filter((x) => x.tenantId !== tenantId).concat(upsells);
  }
  async opex(tenantId: string) {
    return store().opex.filter((o) => o.tenantId === tenantId);
  }
  async saveOpex(tenantId: string, lines: OpexLine[]) {
    const s = store();
    s.opex = s.opex.filter((x) => x.tenantId !== tenantId).concat(lines);
  }

  async suppliers(tenantId: string) {
    return store().suppliers.filter((s) => s.tenantId === tenantId);
  }
  async saveSuppliers(tenantId: string, sup: Supplier[]) {
    const s = store();
    s.suppliers = s.suppliers.filter((x) => x.tenantId !== tenantId).concat(sup);
  }
  async inventory(tenantId: string) {
    return D.demoInventory[tenantId] ?? [];
  }
  async spendPlan(tenantId: string) {
    return store().spendPlans[tenantId] ?? { tenantId, months: [] };
  }
  async saveSpendPlan(plan: SpendPlan) {
    store().spendPlans[plan.tenantId] = plan;
  }

  async forecastInputs(tenantId: string) {
    return store().forecasts[tenantId] ?? null;
  }
  async saveForecastInputs(tenantId: string, inputs: ForecastInputs) {
    store().forecasts[tenantId] = inputs;
  }

  async brandBook(tenantId: string) {
    return store().brandBooks[tenantId] ?? emptyBrandBook(tenantId);
  }
  async saveBrandBook(book: BrandBook) {
    const next = { ...book, version: book.version + 1, updatedAt: new Date().toISOString() };
    store().brandBooks[book.tenantId] = next;
    return next;
  }

  async dailyMetrics(tenantId: string, fromDate: string) {
    return (D.demoDaily[tenantId] ?? []).filter((r) => r.date >= fromDate);
  }
  async supportMetrics(tenantId: string, fromDate: string) {
    return (D.demoSupport[tenantId] ?? []).filter((r) => r.date >= fromDate);
  }
  async cohorts(tenantId: string) {
    return D.demoCohorts[tenantId] ?? [];
  }
  async adInsights(tenantId: string, fromDate: string) {
    return (D.demoAds[tenantId] ?? []).filter((r) => r.date >= fromDate);
  }
  async integrations(tenantId: string) {
    return D.demoIntegrations[tenantId] ?? [];
  }
  async creativeTasks(tenantId: string) {
    return D.demoTasks[tenantId] ?? [];
  }

  async wbrReports(tenantId: string, limit: number) {
    return store().wbr.filter((r) => r.tenantId === tenantId).sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, limit);
  }
  async saveWbrReport(r: WbrReport) {
    const s = store();
    s.wbr = s.wbr.filter((x) => !(x.tenantId === r.tenantId && x.weekStart === r.weekStart)).concat(r);
  }
  async annotateWbr(reportId: string, annotation: string) {
    const r = store().wbr.find((x) => x.id === reportId);
    if (r) r.coachAnnotation = annotation;
  }
  async wbrState(tenantId: string) {
    return store().wbrState[tenantId] ?? emptyWbrState();
  }
  async saveWbrState(tenantId: string, state: WbrState) {
    store().wbrState[tenantId] = state;
  }

  async notes(tenantId: string) {
    return store().notes.filter((n) => n.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addNote(n: Omit<CoachNote, "id" | "createdAt">) {
    const note: CoachNote = { ...n, id: `n-${Date.now()}`, createdAt: new Date().toISOString() };
    store().notes.push(note);
    return note;
  }
}
