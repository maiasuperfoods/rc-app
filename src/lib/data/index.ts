import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DataSource, SessionUser } from "./source";
import { DemoSource } from "./demo";
import { SupabaseSource } from "./supabase";
import { isDemoMode, supabaseServer } from "@/lib/supabase/server";
import type { Membership, Tenant } from "@/lib/types";

export const TENANT_COOKIE = "rc_tenant";
export const DEMO_ROLE_COOKIE = "rc_demo_role"; // "coach" | "student" — demo only

export async function getDataSource(): Promise<DataSource> {
  if (isDemoMode()) {
    const c = await cookies();
    return new DemoSource(c.get(DEMO_ROLE_COOKIE)?.value !== "student");
  }
  return new SupabaseSource(await supabaseServer());
}

export interface AppContext {
  db: DataSource;
  user: SessionUser;
  memberships: Membership[];
  isCoach: boolean;
  tenants: Tenant[]; // tenants this user can switch between
  tenant: Tenant | null; // the active tenant
  demo: boolean;
  /** Only a student on their own brand may change its data. Coaches see every brand read-only. */
  canEdit: boolean;
}

/** Resolves the signed-in user and the active tenant. Redirects to /login when signed out. */
export async function getContext(opts: { requireTenant?: boolean } = {}): Promise<AppContext> {
  const db = await getDataSource();
  const user = await db.currentUser();
  if (!user) redirect("/login");
  const [memberships, isCoach] = await Promise.all([db.memberships(user.id), db.isCoach(user.id)]);
  const tenants = isCoach ? await db.tenants("all") : await db.tenants(memberships.map((m) => m.tenantId));
  const c = await cookies();
  const wanted = c.get(TENANT_COOKIE)?.value;
  const tenant = tenants.find((t) => t.id === wanted) ?? tenants[0] ?? null;
  if (opts.requireTenant && !tenant) redirect(isCoach ? "/admin" : "/onboarding");
  const demo = isDemoMode();
  const canEdit = Boolean(tenant) && (demo || memberships.some((m) => m.tenantId === tenant!.id));
  return { db, user, memberships, isCoach, tenants, tenant, demo, canEdit };
}

export async function requireCoach(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx.isCoach) redirect("/");
  return ctx;
}
