import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getContext } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { saveCredentials } from "@/lib/integrations/store";
import { SHOPIFY_SCOPES, shopifyCleanShop, shopifyExchangeCode, shopifyVerifyQueryHmac } from "@/lib/integrations/shopify";
import { metaExchangeCode, metaListAdAccounts } from "@/lib/integrations/meta";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const origin = process.env.APP_URL ?? url.origin;
  const c = await cookies();
  const saved = c.get("rc_oauth_state")?.value;
  const fail = (msg: string) => {
    c.delete("rc_oauth_state");
    return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(msg)}`, origin));
  };
  if (!saved) return fail("The connection timed out. Please try again.");

  let parsed: { state: string; tenantId: string | null; ret: string; shop?: string; source?: string };
  try {
    parsed = JSON.parse(saved);
  } catch {
    return fail("The connection didn't come back the way we expected. Please try again.");
  }
  const { state, tenantId, ret, source } = parsed;
  if (url.searchParams.get("state") !== state) return fail("The connection didn't come back the way we expected. Please try again.");
  const code = url.searchParams.get("code");
  if (!code) return fail("The connection was cancelled.");

  const admin = supabaseAdmin();
  const redirectUri = `${origin}/api/integrations/${provider}/callback`;
  let reconnected = false;

  try {
    if (provider === "shopify") {
      // Shopify signs the callback; verify before the code is exchanged.
      if (!shopifyVerifyQueryHmac(url.searchParams)) return fail("That response didn't come from Shopify. Please start again.");
      const shop = shopifyCleanShop(url.searchParams.get("shop"));
      if (!shop) return fail("That store address isn't valid.");
      if (parsed.shop && parsed.shop !== shop) return fail("The store changed during sign-in. Please start again.");
      const token = await shopifyExchangeCode(shop, code);
      // Has this store been connected before? Decides reinstall vs first install, below.
      const known = tenantId ? null : await tenantForShop(admin, shop);

      if (tenantId) {
        // Started inside the app by a signed-in student: check they still have the brand, then save.
        const ctx = await getContext();
        if (!ctx.tenants.some((t) => t.id === tenantId)) return fail("You don't have access to that brand.");
        await saveCredentials(admin, tenantId, "shopify", { accessToken: token, externalId: shop });
        await admin.from("shopify_pending_installs").delete().eq("shop", shop);
      } else if (known) {
        // Reinstall. This store has been connected before, so the brand is already known: put the
        // new token straight back on it. Parking it for a manual re-link instead is the classic
        // reinstall failure — a returning merchant finds themselves at a sign-in wall holding a
        // connection they already made.
        await saveCredentials(admin, known, "shopify", { accessToken: token, externalId: shop });
        await admin.from("shopify_pending_installs").delete().eq("shop", shop);
        reconnected = true;
      } else {
        // Started on Shopify's side: there is no brand to attach it to yet, so park the token
        // and let the next sign-in link it (see /shopify/connected and the Connections page).
        await admin.from("shopify_pending_installs").upsert({
          shop,
          credentials_enc: encrypt(JSON.stringify({ accessToken: token, externalId: shop })),
          scopes: SHOPIFY_SCOPES,
          claimed_at: null,
          claimed_tenant_id: null,
        });
        c.set("rc_shopify_pending", shop, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
      }
    } else if (provider === "meta") {
      if (!tenantId) return fail("Please start the connection from the Connections page.");
      const ctx = await getContext();
      if (!ctx.tenants.some((t) => t.id === tenantId)) return fail("You don't have access to that brand.");
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
  // A reinstall is already attached to its brand, so there is nothing left to do — go to the
  // dashboard. A first install from Shopify's side still needs an account before it can be linked.
  const dest = reconnected ? "/?reconnected=shopify" : source === "shopify" ? "/shopify/connected" : ret || "/integrations";
  return NextResponse.redirect(new URL(dest, origin));
}

/** The brand a store is already connected to, if any. */
async function tenantForShop(db: ReturnType<typeof supabaseAdmin>, shop: string): Promise<string | null> {
  const { data } = await db.from("integrations").select("tenant_id").eq("provider", "shopify").eq("external_id", shop).maybeSingle();
  return (data?.tenant_id as string) ?? null;
}
