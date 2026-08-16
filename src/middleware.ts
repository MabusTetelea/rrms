import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap gate: bounce requests with no session cookie straight to /login so an
 * unauthenticated visitor never triggers a database round trip.
 *
 * This is NOT the security boundary — middleware runs on the edge runtime and
 * can't validate the token against Postgres. The real check is requireUser()
 * in (app)/layout.tsx and in each server action.
 */
const SESSION_COOKIE = "rrms_session";

export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Everything except the sign-in page, the auth actions that page posts to,
     * Next's own assets, and the cron sync endpoint (which carries its own
     * bearer token).
     */
    "/((?!login|api/sync|_next/static|_next/image|favicon.ico).*)",
  ],
};
