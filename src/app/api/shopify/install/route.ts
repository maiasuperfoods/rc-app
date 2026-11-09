import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { shopifyAuthUrl, shopifyCleanShop, shopifyVerifyQueryHmac } from "@/lib/integrations/shopify";

/**
 * Entry point for an install that starts on Shopify's side: the App Store listing, the admin,
 * or a direct install link. Shopify calls the app's App URL with ?shop=&hmac=&host= and expects an
 * immediate redirect to the OAuth grant screen — an app that renders anything else is not approved.
 *
 * The signed-in path (a student pressing Connect inside the app) goes through
 * /api/integrations/shopify/start instead; both end at the same callback.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shop = shopifyCleanShop(url.searchParams.get("shop"));
  const origin = process.env.APP_URL ?? url.origin;
  if (!shop) return NextResponse.redirect(new URL("/login", origin));
  // Shopify signs these parameters; an unsigned or tampered request never reaches the grant screen.
  if (url.searchParams.has("hmac") && !shopifyVerifyQueryHmac(url.searchParams)) {
    return new NextResponse("Invalid request signature.", { status: 400 });
  }

  const state = randomBytes(16).toString("hex");
  const c = await cookies();
  c.set("rc_oauth_state", JSON.stringify({ state, tenantId: null, ret: "/shopify/connected", shop, source: "shopify" }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(shopifyAuthUrl(shop, state, `${origin}/api/integrations/shopify/callback`));
}
