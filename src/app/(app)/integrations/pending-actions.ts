"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getContext } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { saveCredentials } from "@/lib/integrations/store";
import { shopifyCleanShop } from "@/lib/integrations/shopify";
import type { Credentials } from "@/lib/integrations/types";

/** Attaches a store that was installed from Shopify's side to the brand the student is in. */
export async function claimShopifyInstall(shop: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext({ requireTenant: true });
  if (ctx.demo) return { ok: false, error: "Not available in the demo." };
  if (!ctx.canEdit) return { ok: false, error: "Only the brand's owner can connect a store." };
  const clean = shopifyCleanShop(shop);
  if (!clean) return { ok: false, error: "That store address isn't valid." };

  const db = supabaseAdmin();
  const { data } = await db.from("shopify_pending_installs").select("credentials_enc, claimed_tenant_id").eq("shop", clean).maybeSingle();
  if (!data) return { ok: false, error: "That connection has expired. Please connect again from this page." };
  if (data.claimed_tenant_id && data.claimed_tenant_id !== ctx.tenant!.id) return { ok: false, error: "That store is already linked to another brand." };

  const creds = JSON.parse(decrypt(data.credentials_enc)) as Credentials;
  await saveCredentials(db, ctx.tenant!.id, "shopify", creds);
  await db.from("shopify_pending_installs").delete().eq("shop", clean);
  (await cookies()).delete("rc_shopify_pending");
  revalidatePath("/integrations");
  return { ok: true };
}

/** Dismisses the banner without linking. The token stays parked until it is claimed or the app is uninstalled. */
export async function dismissShopifyInstall(): Promise<{ ok: boolean }> {
  (await cookies()).delete("rc_shopify_pending");
  revalidatePath("/integrations");
  return { ok: true };
}
