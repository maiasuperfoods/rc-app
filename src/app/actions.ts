"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_ROLE_COOKIE, TENANT_COOKIE, getContext, requireCoach } from "@/lib/data";
import type { BrandBook, CostInputs, Offer, OpexLine, Sku, SpendPlan, Supplier, Tenant, Upsell } from "@/lib/types";

async function tenantCtx() {
  const ctx = await getContext({ requireTenant: true });
  return { ...ctx, tenantId: ctx.tenant!.id };
}

export async function switchTenant(tenantId: string) {
  const ctx = await getContext();
  if (!ctx.tenants.some((t) => t.id === tenantId)) throw new Error("You don't have access to that brand.");
  (await cookies()).set(TENANT_COOKIE, tenantId, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setDemoRole(role: "coach" | "student") {
  (await cookies()).set(DEMO_ROLE_COOKIE, role, { path: "/", httpOnly: true, sameSite: "lax" });
  (await cookies()).delete(TENANT_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function saveCostInputs(input: Omit<CostInputs, "tenantId">) {
  const { db, tenantId } = await tenantCtx();
  await db.saveCostInputs({ ...input, tenantId });
  revalidatePath("/unit-economics");
  revalidatePath("/");
}

export async function saveSkus(skus: Sku[]) {
  const { db, tenantId } = await tenantCtx();
  await db.upsertSkus(tenantId, skus.map((s) => ({ ...s, tenantId })));
  revalidatePath("/unit-economics");
  revalidatePath("/inventory");
}

export async function saveOffers(offers: Offer[]) {
  const { db, tenantId } = await tenantCtx();
  await db.saveOffers(tenantId, offers.map((o) => ({ ...o, tenantId })));
  revalidatePath("/unit-economics");
  revalidatePath("/");
}

export async function saveUpsells(upsells: Upsell[]) {
  const { db, tenantId } = await tenantCtx();
  await db.saveUpsells(tenantId, upsells.map((u) => ({ ...u, tenantId })));
  revalidatePath("/unit-economics");
}

export async function saveOpex(lines: OpexLine[]) {
  const { db, tenantId } = await tenantCtx();
  await db.saveOpex(tenantId, lines.map((l) => ({ ...l, tenantId })));
  revalidatePath("/unit-economics");
}

export async function saveSuppliers(s: Supplier[]) {
  const { db, tenantId } = await tenantCtx();
  await db.saveSuppliers(tenantId, s.map((x) => ({ ...x, tenantId })));
  revalidatePath("/inventory");
}

export async function saveSpendPlan(months: SpendPlan["months"]) {
  const { db, tenantId } = await tenantCtx();
  await db.saveSpendPlan({ tenantId, months });
  revalidatePath("/inventory");
}

export async function saveBrandBook(book: BrandBook) {
  const { db, tenantId, user } = await tenantCtx();
  const saved = await db.saveBrandBook({ ...book, tenantId }, user.id);
  revalidatePath("/brand-book");
  revalidatePath("/creative");
  return saved.version;
}

export async function updateTenant(patch: Partial<Pick<Tenant, "name" | "domain" | "stage" | "onboardingComplete">>) {
  const { db, tenantId } = await tenantCtx();
  await db.updateTenant(tenantId, patch);
  revalidatePath("/", "layout");
}

export async function createBrand(input: { name: string; domain: string; stage: Tenant["stage"] }) {
  const ctx = await getContext();
  const t = await ctx.db.createTenant({ name: input.name.trim(), domain: input.domain.trim() || null, stage: input.stage, ownerId: ctx.user.id });
  (await cookies()).set(TENANT_COOKIE, t.id, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
  return t.id;
}

export async function addCoachNote(tenantId: string, body: string) {
  const ctx = await requireCoach();
  await ctx.db.addNote({ tenantId, authorId: ctx.user.id, authorName: ctx.user.name, body: body.trim() });
  revalidatePath(`/admin/${tenantId}`);
}

export async function annotateWbr(tenantId: string, reportId: string, annotation: string) {
  const ctx = await requireCoach();
  await ctx.db.annotateWbr(reportId, annotation);
  revalidatePath(`/admin/${tenantId}`);
  revalidatePath("/wbr");
}

export async function coachViewTenant(tenantId: string) {
  await requireCoach();
  (await cookies()).set(TENANT_COOKIE, tenantId, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect("/");
}
