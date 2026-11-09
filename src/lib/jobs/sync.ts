/**
 * Ingestion job. Runs from /api/cron/sync (hourly) and /api/cron/backfill (nightly), or from workers/sync.ts by hand.
 *
 *   npx tsx workers/sync.ts            # incremental sync for every connected tenant
 *   npx tsx workers/sync.ts --backfill # 24-month backfill for tenants whose backfill_progress < 1
 *   npx tsx workers/sync.ts --tenant <id>
 *
 * Every write is an upsert keyed on (tenant_id, date[, ad_id]) so re-running is safe.
 * Backfill walks month by month and records progress so onboarding is never blocked.
 */
import { supabaseAdmin } from "@/lib/supabase/server";
import { PROVIDERS, loadCredentials, markSync, type Provider } from "@/lib/integrations/store";
import { shopify } from "@/lib/integrations/shopify";
import { meta } from "@/lib/integrations/meta";
import { tripleWhale, tripleWhaleAdAttribution } from "@/lib/integrations/triple-whale";
import { lifetimely } from "@/lib/integrations/lifetimely";
import { commslayer } from "@/lib/integrations/commslayer";
import type { SupabaseClient } from "@supabase/supabase-js";

const BACKFILL_MONTHS = 24;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Incremental sync (last 7 days) or month-by-month backfill for every connected integration. Safe to re-run. */
export async function runSync({ backfill = false, tenantId = null as string | null } = {}) {
  const db = supabaseAdmin();
  let q = db.from("integrations").select("tenant_id, provider, connected, backfill_progress").eq("connected", true);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: rows, error } = await q;
  if (error) throw error;
  let ran = 0, failed = 0;
  for (const r of rows ?? []) {
    if (backfill && (r.backfill_progress ?? 0) >= 1) continue;
    ran++;
    await runOne(db, r.tenant_id, r.provider as Provider, backfill).catch((e) => { failed++; console.error(`[sync] ${r.tenant_id}/${r.provider} failed:`, e); });
  }
  await alertCoaches(db);
  return { ran, failed };
}

async function runOne(db: SupabaseClient, tenantId: string, provider: Provider, backfill: boolean) {
  const creds = await loadCredentials(db, tenantId, provider);
  if (!creds) return;
  const jobId = await startJob(db, tenantId, provider);
  try {
    const today = new Date();
    const windows: [string, string][] = [];
    if (backfill) {
      for (let m = BACKFILL_MONTHS - 1; m >= 0; m--) {
        const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 1));
        const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m + 1, 0));
        windows.push([iso(start), iso(end > today ? today : end)]);
      }
    } else {
      // Incremental: last 7 days so late attribution and refunds settle.
      windows.push([iso(new Date(today.getTime() - 7 * 86400000)), iso(today)]);
    }
    let rowsWritten = 0;
    for (let i = 0; i < windows.length; i++) {
      const [from, to] = windows[i];
      rowsWritten += await pullAndWrite(db, tenantId, provider, creds, from, to);
      if (backfill) await markSync(db, tenantId, provider, { backfillProgress: (i + 1) / windows.length });
    }
    await markSync(db, tenantId, provider, { lastError: null, synced: true, backfillProgress: backfill ? 1 : undefined });
    await finishJob(db, jobId, "ok", rowsWritten, null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    await markSync(db, tenantId, provider, { lastError: msg });
    await finishJob(db, jobId, "error", 0, msg);
    throw e;
  }
}

async function pullAndWrite(db: SupabaseClient, tenantId: string, provider: Provider, creds: NonNullable<Awaited<ReturnType<typeof loadCredentials>>>, from: string, to: string): Promise<number> {
  const up = async (table: string, rows: Record<string, unknown>[], onConflict: string) => {
    if (!rows.length) return 0;
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    return rows.length;
  };
  switch (provider) {
    case "shopify": {
      const s = await shopify.pull(tenantId, creds, from, to);
      let n = 0;
      n += await up("products", s.products.map((p) => ({ id: p.id, tenant_id: tenantId, title: p.title, shopify_product_id: p.shopifyProductId, active: p.active })), "id");
      // Keep a student's hand-entered landed cost; only fill it from Shopify when empty.
      const { data: existing } = await db.from("skus").select("id, landed_cost").eq("tenant_id", tenantId);
      const cost = new Map((existing ?? []).map((r) => [r.id, Number(r.landed_cost)]));
      n += await up("skus", s.skus.map((k) => ({ id: k.id, tenant_id: tenantId, product_id: k.productId, sku: k.sku, variant_title: k.variantTitle, shopify_variant_id: k.shopifyVariantId, landed_cost: cost.get(k.id) || k.landedCost, units_per_pack: 1 })), "id");
      n += await up("inventory_levels", s.inventory.map((i) => ({ tenant_id: tenantId, sku_id: i.skuId, on_hand: i.onHand, daily_velocity_30: i.dailyVelocity30, updated_at: new Date().toISOString() })), "tenant_id,sku_id");
      // Shopify daily numbers are the fallback when Triple Whale is not connected (source column wins on conflict in SQL).
      const tw = await loadCredentials(db, tenantId, "triple_whale");
      if (!tw) n += await up("daily_business_metrics", s.daily.map((d) => ({ tenant_id: tenantId, date: d.date, revenue: d.revenue, orders: d.orders, new_customers: d.newCustomers, returning_customers: d.returningCustomers, ad_spend: 0, refunds: d.refunds, cogs: d.cogs, source: "shopify" })), "tenant_id,date");
      const lt = await loadCredentials(db, tenantId, "lifetimely");
      if (!lt) n += await up("cohorts", s.cohorts.map((c) => ({ tenant_id: tenantId, cohort_month: c.cohortMonth, customers: c.customers, ltv30: c.ltv30, ltv60: c.ltv60, ltv90: c.ltv90, ltv180: c.ltv180, repurchase_rate: c.repurchaseRate, source: "shopify" })), "tenant_id,cohort_month");
      return n;
    }
    case "meta": {
      const rows = await meta.pull(tenantId, creds, from, to);
      // Keep NC/TW attribution written by the Triple Whale pixel pass: upsert only the Meta columns.
      let n = await up("ad_daily_insights", rows.map((r) => ({ tenant_id: tenantId, date: r.date, ad_id: r.adId, ad_name: r.adName, ad_set_id: r.adSetId, ad_set_name: r.adSetName, campaign_id: r.campaignId, campaign_name: r.campaignName, format: r.format, spend: r.spend, impressions: r.impressions, clicks: r.clicks, link_clicks: r.linkClicks, meta_purchases: r.metaPurchases, meta_revenue: r.metaRevenue, plays_3s: r.plays3s, thruplays: r.thruplays, launched_at: r.launchedAt })), "tenant_id,date,ad_id");
      const tw = await loadCredentials(db, tenantId, "triple_whale");
      if (tw) {
        const attr = await tripleWhaleAdAttribution(tw, from, to);
        n += await up("ad_daily_insights", attr.map((r) => ({ tenant_id: tenantId, date: r.date, ad_id: r.adId, ad_name: r.adName, tw_purchases: r.twPurchases, tw_revenue: r.twRevenue, nc_purchases: r.ncPurchases, nc_revenue: r.ncRevenue, new_visitors: r.newVisitors, unique_visitors: r.uniqueVisitors })), "tenant_id,date,ad_id");
      }
      return n;
    }
    case "triple_whale": {
      const rows = await tripleWhale.pull(tenantId, creds, from, to);
      return up("daily_business_metrics", rows.map((d) => ({ tenant_id: tenantId, date: d.date, revenue: d.revenue, orders: d.orders, new_customers: d.newCustomers, returning_customers: d.returningCustomers, ad_spend: d.adSpend, refunds: d.refunds, cogs: d.cogs, source: "triple_whale" })), "tenant_id,date");
    }
    case "lifetimely": {
      const rows = await lifetimely.pull(tenantId, creds, from, to);
      return up("cohorts", rows.map((c) => ({ tenant_id: tenantId, cohort_month: c.cohortMonth, customers: c.customers, ltv30: c.ltv30, ltv60: c.ltv60, ltv90: c.ltv90, ltv180: c.ltv180, repurchase_rate: c.repurchaseRate, source: "lifetimely" })), "tenant_id,cohort_month");
    }
    case "commslayer": {
      const rows = await commslayer.pull(tenantId, creds, from, to);
      return up("daily_support_metrics", rows.map((d) => ({ tenant_id: tenantId, date: d.date, tickets: d.tickets, first_response_minutes: d.firstResponseMinutes, refund_requests: d.refundRequests, chargeback_alerts: d.chargebackAlerts, top_reasons: d.topReasons })), "tenant_id,date");
    }
  }
  return 0;
}

async function startJob(db: SupabaseClient, tenantId: string, provider: string) {
  const { data } = await db.from("sync_jobs").insert({ tenant_id: tenantId, provider, status: "running" }).select("id").single();
  return data?.id as string;
}
async function finishJob(db: SupabaseClient, id: string, status: "ok" | "error", rows: number, error: string | null) {
  if (!id) return;
  await db.from("sync_jobs").update({ status, rows_written: rows, error, finished_at: new Date().toISOString() }).eq("id", id);
}

/** One Slack message per run listing connections that need attention. */
async function alertCoaches(db: SupabaseClient) {
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (!hook) return;
  const { data } = await db.from("integrations").select("tenant_id, provider, last_error, tenants(name)").not("last_error", "is", null);
  if (!data?.length) return;
  const lines = data.map((r: { provider: string; last_error: string; tenants: { name: string } | { name: string }[] | null }) => {
    const t = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
    return `• ${t?.name ?? r.provider}: ${r.provider} — ${r.last_error}`;
  });
  await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `Connections needing attention:\n${lines.join("\n")}` }) });
}

