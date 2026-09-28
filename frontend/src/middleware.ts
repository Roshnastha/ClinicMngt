/**
 * Route guards (edge middleware).
 *
 * The auth-context mirrors a `pd_auth` cookie when a session exists, so this
 * middleware can redirect before any client JS runs. It deliberately does NOT
 * validate the JWT – the API enforces that on every request (401 → client
 * clears state → next navigation hits /login).
 */

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "pd_auth";

// Routes that require a session.
const PROTECTED_PREFIXES = ["/dashboard", "/patients", "/schedule", "/billing", "/therapists"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(COOKIE_NAME)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isLoginPage = pathname === "/login";

  if (isProtected && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoginPage && hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on protected routes + login only; skip API/static assets.
  matcher: [
    "/dashboard/:path*",
    "/patients/:path*",
    "/schedule/:path*",
    "/billing/:path*",
    "/therapists/:path*",
    "/login",
  ],
};
