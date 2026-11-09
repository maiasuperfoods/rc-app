import { shopifyCleanShop } from "@/lib/integrations/shopify";
import { EmbeddedFrame } from "./frame";

export const dynamic = "force-dynamic";

/**
 * The page Shopify renders inside the admin. The dashboard itself is a full-screen workspace that
 * doesn't belong in an admin iframe, so this confirms the connection and opens the real thing.
 */
export default async function ShopifyEmbeddedPage({ searchParams }: { searchParams: Promise<{ shop?: string; host?: string }> }) {
  const sp = await searchParams;
  const shop = shopifyCleanShop(sp.shop);
  const appUrl = (process.env.APP_URL ?? "https://app.renaissancecommerce.com").replace(/\/$/, "");
  return <EmbeddedFrame shop={shop} appUrl={appUrl} apiKey={process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ?? ""} host={sp.host ?? ""} />;
}
