import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Refreshes the Supabase session cookie on session-bearing routes only.
// Catalog routes are excluded by the matcher so they stay cacheable and never touch auth.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Validates the JWT and refreshes it if needed. Authorisation still happens in pages and RLS.
  const { data } = await supabase.auth.getClaims();

  // Optimistic check only: signed-out and guest visitors never reach admin pages.
  // The role check itself lives in app/admin/(protected)/layout.tsx and in RLS.
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isDevShowcase = pathname.startsWith("/admin/dev/");
  if (isAdminPage && !isDevShowcase && (!data?.claims.sub || data.claims.is_anonymous)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/cart/:path*",
    "/checkout/:path*",
    "/account/:path*",
    "/orders/:path*",
    "/login/:path*",
    "/admin/:path*",
  ],
};
