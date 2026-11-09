import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { shopifyVerifyWebhook } from "@/lib/integrations/shopify";

/**
 * Shopify webhooks. Every request is verified against X-Shopify-Hmac-Sha256 before anything is read,
 * and an unverified request gets 401 with no side effects.
 *
 * Mandatory compliance topics (required for App Store distribution):
 *   customers/data_request  a customer asked the merchant for their data
 *   customers/redact        a customer asked the merchant to erase their data
 *   shop/redact             48h after uninstall: erase the shop's data
 * Plus:
 *   app/uninstalled         the access token is already void; disconnect and delete it immediately
 *
 * What this app holds about customers: nothing identifiable. Orders are read to produce daily totals
 * and cohort averages; a Shopify customer id is used in memory to group a cohort and is never written
 * to our database. So a data request has nothing to return and a customer redaction has nothing to erase —
 * both are acknowledged and recorded.
 */
export const dynamic = "force-dynamic";

const TOPICS = ["customers/data_request", "customers/redact", "shop/redact", "app/uninstalled"] as const;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!shopifyVerifyWebhook(raw, req.headers.get("x-shopify-hmac-sha256"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const topic = (req.headers.get("x-shopify-topic") ?? "").toLowerCase();
  const shop = (req.headers.get("x-shopify-shop-domain") ?? "").toLowerCase() || null;
  if (!TOPICS.includes(topic as (typeof TOPICS)[number])) return new NextResponse("OK", { status: 200 });

  let outcome = "acknowledged";
  // Only the two topics that erase data should be retried by Shopify if the work fails.
  const mustSucceed = topic === "shop/redact" || topic === "app/uninstalled";
  let failed = false;

  try {
    const db = supabaseAdmin();
    const tenantId = shop ? await tenantForShop(db, shop) : null;
    if (topic === "app/uninstalled" && shop) {
      await db.from("shopify_pending_installs").delete().eq("shop", shop);
      if (tenantId) {
        await db.from("integrations").update({ connected: false, credentials_enc: null, last_error: "Disconnected: the app was removed from your Shopify admin." }).eq("tenant_id", tenantId).eq("provider", "shopify");
        outcome = "token deleted, connection marked disconnected";
      } else {
        outcome = "no linked brand; pending install removed";
      }
    } else if (topic === "shop/redact" && shop) {
      await db.from("shopify_pending_installs").delete().eq("shop", shop);
      if (tenantId) {
        await db.from("integrations").delete().eq("tenant_id", tenantId).eq("provider", "shopify");
        await db.from("daily_business_metrics").delete().eq("tenant_id", tenantId).eq("source", "shopify");
        await db.from("cohorts").delete().eq("tenant_id", tenantId).eq("source", "shopify");
        await db.from("inventory_levels").delete().eq("tenant_id", tenantId);
        await db.from("skus").delete().eq("tenant_id", tenantId).not("shopify_variant_id", "is", null);
        await db.from("products").delete().eq("tenant_id", tenantId).not("shopify_product_id", "is", null);
        outcome = "shop data erased";
      } else {
        outcome = "nothing stored for this shop";
      }
    } else {
      // customers/data_request and customers/redact: no customer-identifiable data is stored.
      outcome = "no customer data stored; nothing to return or erase";
    }
    await db.from("shopify_compliance_log").insert({ topic, shop, tenant_id: tenantId, outcome });
  } catch (e) {
    failed = true;
    outcome = `error: ${(e as Error).message}`;
    console.error("[shopify webhook]", topic, shop, outcome);
    // Best-effort audit entry; never let logging itself change the response.
    try {
      await supabaseAdmin().from("shopify_compliance_log").insert({ topic, shop, tenant_id: null, outcome });
    } catch {}
  }

  // A customer topic is always acknowledged — there is nothing for it to do. An erasure that failed
  // returns 503 so Shopify retries rather than assuming the data is gone.
  if (failed && mustSucceed) return new NextResponse("Retry", { status: 503 });
  return new NextResponse("OK", { status: 200 });
}

async function tenantForShop(db: ReturnType<typeof supabaseAdmin>, shop: string): Promise<string | null> {
  const { data } = await db.from("integrations").select("tenant_id").eq("provider", "shopify").eq("external_id", shop).maybeSingle();
  return (data?.tenant_id as string) ?? null;
}
