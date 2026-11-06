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
    const allowed = p.startsWith("/knowledge-base") || p.startsWith("/resources") || p.startsWith("/login") || p.startsWith("/auth") || /\.[a-z0-9]+$/i.test(p);
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/knowledge-base";
      url.search = "";
      return NextResponse.redirect(url);
    }
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
  const isPublic = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/api/webhooks");
  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|rc-mark.png|rc-wordmark.png).*)"],
};
