import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { shopifyCleanShop } from "@/lib/integrations/shopify";

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * users to /login. Skipped entirely in demo mode.
 */
export async function proxy(request: NextRequest) {
  // Standalone Knowledge Base deployment: only the course, resources and sign-in are served; everything else lands on the course.
  if (process.env.KB_STANDALONE === "true") {
    const p = request.nextUrl.pathname;
    const allowed = p.startsWith("/knowledge-base") || p.startsWith("/resources") || p.startsWith("/api/media") || p.startsWith("/login") || p.startsWith("/auth") || /\.[a-z0-9]+$/i.test(p);
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/knowledge-base";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const sp = request.nextUrl.searchParams;
  const shopParam = shopifyCleanShop(sp.get("shop"));
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  // Shopify loading the app inside the admin iframe (embedded=1). Serve the embedded page and
  // never start OAuth here: a redirect to Shopify's grant screen from inside the frame is blocked
  // by frame-ancestors and is one of the failures app review looks for. Rewrite rather than
  // redirect so the host/shop params Shopify set stay on the URL for App Bridge.
  if (sp.get("embedded") === "1" && !isApi && shopParam) {
    const url = request.nextUrl.clone();
    url.pathname = "/shopify/embedded";
    const res = NextResponse.rewrite(url);
    // An embedded app must be framable by that store's admin, and by nothing else.
    res.headers.set("Content-Security-Policy", `frame-ancestors https://${shopParam} https://admin.shopify.com;`);
    return res;
  }

  // A merchant installing from the App Store or a direct link lands on the app's root URL with
  // ?shop=&hmac= and no embedded flag. Shopify requires an immediate move to the grant screen.
  if (sp.has("shop") && sp.has("hmac") && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/shopify/install";
    return NextResponse.redirect(url);
  }

  // The embedded page reached directly (App Bridge re-navigations) still needs to be framable.
  if (request.nextUrl.pathname === "/shopify/embedded" && shopParam) {
    const res = NextResponse.next();
    res.headers.set("Content-Security-Policy", `frame-ancestors https://${shopParam} https://admin.shopify.com;`);
    return res;
  }

  const demo = process.env.DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (demo) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/api/webhooks") || path.startsWith("/api/cron") || path.startsWith("/api/media") || path.startsWith("/api/shopify") || path.startsWith("/shopify") || path === "/privacy";
  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|rc-mark.png|rc-wordmark.png).*)"],
};
