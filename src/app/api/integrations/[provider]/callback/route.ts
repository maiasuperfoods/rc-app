import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getContext } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/server";
import { saveCredentials } from "@/lib/integrations/store";
import { shopifyExchangeCode } from "@/lib/integrations/shopify";
import { metaExchangeCode, metaListAdAccounts } from "@/lib/integrations/meta";

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const c = await cookies();
  const saved = c.get("rc_oauth_state")?.value;
  const fail = (msg: string) => NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(msg)}`, req.url));
  if (!saved) return fail("The connection timed out. Please try again.");
  const { state, tenantId, ret } = JSON.parse(saved) as { state: string; tenantId: string; ret: string };
  if (url.searchParams.get("state") !== state) return fail("The connection didn't come back the way we expected. Please try again.");
  const ctx = await getContext();
  if (!ctx.tenants.some((t) => t.id === tenantId)) return fail("You don't have access to that brand.");
  const code = url.searchParams.get("code");
  if (!code) return fail("The connection was cancelled.");
  const admin = supabaseAdmin();
  const redirectUri = `${process.env.APP_URL ?? url.origin}/api/integrations/${provider}/callback`;
  try {
    if (provider === "shopify") {
      const shop = url.searchParams.get("shop")!;
      const token = await shopifyExchangeCode(shop, code);
      await saveCredentials(admin, tenantId, "shopify", { accessToken: token, externalId: shop });
    } else if (provider === "meta") {
      const { token, expiresAt } = await metaExchangeCode(code, redirectUri);
      const accounts = await metaListAdAccounts(token);
      if (accounts.length === 0) return fail("That Facebook login has no active ad accounts.");
      // Pick the first active account now; the Connections page lets the student change it.
      await saveCredentials(admin, tenantId, "meta", { accessToken: token, expiresAt, externalId: accounts[0].id });
    } else return fail("Unknown connection.");
  } catch (e) {
    console.error(`[oauth ${provider}]`, e);
    return fail("We couldn't finish connecting. Please try again, or ask your coach.");
  }
  c.delete("rc_oauth_state");
  return NextResponse.redirect(new URL(ret, req.url));
}
