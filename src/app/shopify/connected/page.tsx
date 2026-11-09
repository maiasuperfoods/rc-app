import Link from "next/link";
import { cookies } from "next/headers";
import { AuthFrame } from "@/components/auth-frame";

export const dynamic = "force-dynamic";

/**
 * Where a merchant lands after installing from Shopify. The store is connected, but a Shopify install
 * carries no Renaissance Commerce account, so the token waits until they sign in and choose their brand.
 */
export default async function ShopifyConnectedPage() {
  const shop = (await cookies()).get("rc_shopify_pending")?.value ?? null;
  return (
    <AuthFrame>
      <h1 className="display text-2xl mb-2">Store connected</h1>
      <p className="text-sm text-dim mb-6">
        {shop ? <><span className="text-ink">{shop}</span> is connected to Renaissance Commerce.</> : "Your Shopify store is connected to Renaissance Commerce."} Sign in and we&apos;ll finish linking it to your brand, then your orders, products and inventory start loading.
      </p>
      <Link href="/integrations" className="btn btn-primary w-full justify-center">Sign in to finish</Link>
      <p className="text-xs text-mute text-center mt-4">
        Don&apos;t have an account yet? Your coach creates it when you join the program. You can close this window — the connection is saved.
      </p>
    </AuthFrame>
  );
}
