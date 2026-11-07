import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast, optimistic check only: no session cookie → go to sign-in.
 * The real checks (valid session, membership of this business, role) happen
 * on the server in requireTenant() and in Postgres Row-Level Security.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except public pages, auth API, Next internals and static files.
  matcher: [
    "/((?!api/auth|sign-in|sign-up|accept-invite|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|webmanifest)$).+)",
  ],
};
