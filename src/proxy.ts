import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast, optimistic check only: no session cookie → go to sign-in.
 * The real checks (valid session, membership of this business, role) happen
 * on the server in requireTenant() and in Postgres Row-Level Security.
 */
/** Public pages under a business's path: the website Apply form. */
const PUBLIC_PATH = /^\/(embed\/[^/]+\/join|[^/]+\/join)\/?$/;

export function proxy(request: NextRequest) {
  if (PUBLIC_PATH.test(request.nextUrl.pathname)) return NextResponse.next();
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
    "/((?!api/auth|brand/|sign-in|sign-up|accept-invite|forgot-password|reset-password|two-factor|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|webmanifest)$).+)",
  ],
};
