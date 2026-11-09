import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // A merchant installing from the Shopify App Store or admin lands on the app's root URL with
  // ?shop=&hmac=. Shopify requires an immediate redirect to the OAuth grant screen.
  if (request.nextUrl.searchParams.has("shop") && request.nextUrl.searchParams.has("hmac") && !request.nextUrl.pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/shopify/install";
    return NextResponse.redirect(url);
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
