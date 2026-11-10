import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getContext } from "@/lib/data";
import { shopifyAuthUrl, shopifyCleanShop } from "@/lib/integrations/shopify";
import { metaAuthUrl } from "@/lib/integrations/meta";

/** Starts an OAuth flow. Shopify needs the shop domain (?shop=); Meta does not. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const ctx = await getContext({ requireTenant: true });
  if (ctx.demo) return NextResponse.redirect(new URL("/integrations", req.url));
  const url = new URL(req.url);
  const state = randomBytes(16).toString("hex");
  const c = await cookies();
  c.set("rc_oauth_state", JSON.stringify({ state, tenantId: ctx.tenant!.id, ret: url.searchParams.get("return") ?? "/integrations" }), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  const redirectUri = `${process.env.APP_URL ?? url.origin}/api/integrations/${provider}/callback`;

  if (provider === "shopify") {
    const shop = url.searchParams.get("shop");
    if (!shop) {
      // Ask for the store domain with a tiny form rather than a raw error. Self-contained on
      // purpose: it is served from a route handler, so it gets no layout, styles or theme.
      return new NextResponse(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect your Shopify store</title></head><body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0b0d;color:#ece8df;display:grid;place-items:center;min-height:100vh;margin:0;padding:0 20px"><form style="width:100%;max-width:320px"><h1 style="font-weight:500;font-size:20px;margin:0 0 6px">Which Shopify store?</h1><p style="color:#a19b8f;font-size:14px;line-height:1.5;margin:0 0 16px">Enter your store&rsquo;s .myshopify.com address and we&rsquo;ll take you to Shopify to approve the connection.</p><input name="shop" placeholder="your-store.myshopify.com" required autofocus autocapitalize="off" autocorrect="off" spellcheck="false" style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #34343b;background:#0b0b0d;color:#ece8df;font-size:16px"><button style="margin-top:12px;width:100%;padding:11px;border-radius:8px;background:#c9a961;color:#0b0b0d;border:0;font-weight:500;font-size:15px;cursor:pointer">Continue to Shopify</button></form></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    const clean = shopifyCleanShop(shop);
    if (!clean) return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent("That doesn't look like a .myshopify.com address.")}`, req.url));
    return NextResponse.redirect(shopifyAuthUrl(clean, state, redirectUri));
  }
  if (provider === "meta") return NextResponse.redirect(metaAuthUrl(state, redirectUri));
  return NextResponse.json({ message: "This connection uses an API key, not OAuth." }, { status: 400 });
}
