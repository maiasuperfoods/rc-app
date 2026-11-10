import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AuthFrame } from "@/components/auth-frame";
import { getContext } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { saveCredentials } from "@/lib/integrations/store";
import type { Credentials } from "@/lib/integrations/types";

export const dynamic = "force-dynamic";

/**
 * Where a merchant lands after installing from Shopify's side.
 *
 * If they are already signed in with a brand, there is nothing to ask them: the install is attached
 * here and they go straight to the dashboard. Only a visitor with no account sees this page, and it
 * tells them what has happened rather than dropping them at a sign-in wall with no explanation.
 */
export default async function ShopifyConnectedPage() {
  const shop = (await cookies()).get("rc_shopify_pending")?.value ?? null;

  if (shop) {
    const ctx = await getContext().catch(() => null);
    if (ctx?.tenant && ctx.canEdit && !ctx.demo) {
      const db = supabaseAdmin();
      const { data } = await db.from("shopify_pending_installs").select("credentials_enc, claimed_tenant_id").eq("shop", shop).maybeSingle();
      if (data && (!data.claimed_tenant_id || data.claimed_tenant_id === ctx.tenant.id)) {
        await saveCredentials(db, ctx.tenant.id, "shopify", JSON.parse(decrypt(data.credentials_enc)) as Credentials);
        await db.from("shopify_pending_installs").delete().eq("shop", shop);
        (await cookies()).delete("rc_shopify_pending");
        redirect("/?connected=shopify");
      }
    }
  }

  return (
    <AuthFrame>
      <h1 className="display text-2xl mb-2">Store connected</h1>
      <p className="text-sm text-dim mb-6">
        {shop ? <><span className="text-ink">{shop}</span> is connected to Renaissance Commerce.</> : "Your Shopify store is connected to Renaissance Commerce."} Sign in and we&apos;ll finish linking it to your brand, then your orders, products and inventory start loading.
      </p>
      <Link href="/login?next=%2Fshopify%2Fconnected" className="btn btn-primary w-full justify-center">Sign in to finish</Link>
      <p className="text-xs text-mute text-center mt-4">
        Don&apos;t have an account yet? Your coach creates it when you join the program. You can close this window — the connection is saved.
      </p>
    </AuthFrame>
  );
}
