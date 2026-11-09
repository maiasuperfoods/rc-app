import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { shopifyCleanShop } from "@/lib/integrations/shopify";
import { PendingBanner } from "./pending-banner";
import type { AppContext } from "@/lib/data";

/** Shown when this browser finished a Shopify install that hasn't been attached to a brand yet. */
export async function PendingShopifyInstall({ ctx }: { ctx: AppContext }) {
  if (ctx.demo) return null;
  const shop = shopifyCleanShop((await cookies()).get("rc_shopify_pending")?.value);
  if (!shop) return null;
  const { data } = await supabaseAdmin().from("shopify_pending_installs").select("shop").eq("shop", shop).maybeSingle();
  if (!data) return null;
  return <PendingBanner shop={shop} brand={ctx.tenant?.name ?? "this brand"} />;
}
