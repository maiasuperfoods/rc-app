import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getContext } from "@/lib/data";
import { shopifyAuthUrl } from "@/lib/integrations/shopify";
import { metaAuthUrl } from "@/lib/integrations/meta";

/** Starts an OAuth flow. Shopify needs the shop domain (?shop=); Meta does not. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const ctx = await getContext({ requireTenant: true });
  if (ctx.demo) return NextResponse.redirect(new URL("/integrations", req.url));
  const url = new URL(req.url);
  const state = randomBytes(16).toString("hex");
  const c = await cookies();
  c.set("rc_oauth_state", JSON.stringify({ state, tenantId: ctx.tenant!.id, ret: url.searchParams.get("return") ?? "/integrations" }), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  const redirectUri = `${process.env.APP_URL ?? url.origin}/api/integrations/${provider}/callback`;

  if (provider === "shopify") {
    const shop = url.searchParams.get("shop");
    if (!shop) {
      // Ask for the store domain with a tiny form rather than a raw error.
      return new NextResponse(
        `<!doctype html><html><body style="font-family:system-ui;background:#0b0b0d;color:#ece8df;display:grid;place-items:center;height:100vh;margin:0"><form style="width:320px"><h2 style="font-weight:500">Which Shopify store?</h2><p style="color:#a19b8f;font-size:14px">Your store's .myshopify.com address.</p><input name="shop" placeholder="your-store.myshopify.com" required style="width:100%;padding:10px;border-radius:8px;border:1px solid #34343b;background:#0b0b0d;color:#ece8df"/><button style="margin-top:12px;width:100%;padding:10px;border-radius:8px;background:#c9a961;border:0;font-weight:500">Continue to Shopify</button></form></body></html>`,
        { headers: { "content-type": "text/html" } },
      );
    }
    const clean = shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9-]+\.myshopify\.com$/.test(clean)) return NextResponse.redirect(new URL("/integrations?error=That doesn't look like a .myshopify.com address.", req.url));
    return NextResponse.redirect(shopifyAuthUrl(clean, state, redirectUri));
  }
  if (provider === "meta") return NextResponse.redirect(metaAuthUrl(state, redirectUri));
  return NextResponse.json({ message: "This connection uses an API key, not OAuth." }, { status: 400 });
}
